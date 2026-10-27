import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, gt, isNotNull, isNull, lt, notExists, or, sql } from 'drizzle-orm';
import { EstadoServicio, TIPOS_SERVICIO, type TipoServicio } from '@blackout/shared';
import { RELOJ, type Reloj } from '../comun/reloj';
import type { Env } from '../config/env';
import { DB, type BaseDeDatos, type Transaccion } from '../db/db.module';
import { estadoSector, eventosSector, reportes } from '../db/schema';
import { limiteDeVencimiento } from '../reportes/vencimiento.puro';
import { evaluarInicio, evaluarRestablecimiento } from './consenso.puro';

/** Lo que `estado_sector` debe decir tras evaluar un (sector, servicio). */
interface EstadoDeseado {
  estado: EstadoServicio;
  reportesSinConfirmar: number;
  eventoId: number | null;
  desde: Date | null;
}

/**
 * Orquestación del consenso (docs/PLAN.md §6.3). Lo llama `ReportesService` tras cada inicio o
 * cierre, dentro de la misma transacción que escribe el reporte. La decisión vive en las funciones
 * puras de `consenso.puro.ts`; aquí solo se lee, se serializa y se escribe.
 */
@Injectable()
export class ConsensoService {
  private readonly log = new Logger(ConsensoService.name);

  constructor(
    private readonly config: ConfigService<Env, true>,
    @Inject(RELOJ) private readonly reloj: Reloj,
    @Inject(DB) private readonly db: BaseDeDatos,
  ) {}

  /**
   * Marca `vencido` los reportes abiertos hace más de `REPORTE_VENCE_HORAS` (D-015, T-050): dejan de
   * contar para el consenso y liberan el único parcial de REP-05. Se mide desde `inicio_en` (la hora
   * real del evento, OFF-03). Es idempotente: una segunda pasada no encuentra nada que marcar. Con
   * `par`, solo mira ese sector y servicio. Devuelve los pares afectados, sin repetir.
   */
  async vencerReportes(par?: {
    sectorId: number;
    tipoServicio: TipoServicio;
  }): Promise<{ sectorId: number; tipoServicio: TipoServicio }[]> {
    const limite = limiteDeVencimiento(
      this.reloj(),
      this.config.get('REPORTE_VENCE_HORAS', { infer: true }),
    );
    const filas = await this.db
      .update(reportes)
      .set({ vencido: true })
      .where(
        and(
          isNull(reportes.finEn),
          eq(reportes.vencido, false),
          lt(reportes.inicioEn, limite),
          par
            ? and(eq(reportes.sectorId, par.sectorId), eq(reportes.tipoServicio, par.tipoServicio))
            : undefined,
        ),
      )
      .returning({ sectorId: reportes.sectorId, tipoServicio: reportes.tipoServicio });
    const unicos = new Map(filas.map((f) => [`${f.sectorId}/${f.tipoServicio}`, f]));
    return [...unicos.values()];
  }

  /**
   * Reevalúa los pares cuyo estado pudo cambiar solo por el paso del tiempo (CON-07, T-050):
   * los que muestran reportes sin confirmar (que dejan de contar al vencer la ventana), los que
   * tienen un evento abierto y ningún reporte vivo (pueden cerrarse) y los que acaban de perder
   * reportes por vencimiento. Primero marca los vencidos. Cada par va en su propia transacción y un
   * fallo se registra sin cortar el resto. Devuelve cuántos pares revisó.
   */
  async reevaluarVencidos(): Promise<number> {
    let vencidos: { sectorId: number; tipoServicio: TipoServicio }[] = [];
    try {
      vencidos = await this.vencerReportes();
    } catch (e) {
      this.log.error(
        `No se pudieron marcar los reportes vencidos: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    // Un evento abierto solo puede cerrarse por el paso del tiempo si ya no le quedan reportes
    // vivos; con alguno abierto (sin vencer) no hay nada que revisar.
    const reporteVivo = this.db
      .select({ uno: sql`1` })
      .from(reportes)
      .where(
        and(
          eq(reportes.sectorId, estadoSector.sectorId),
          eq(reportes.tipoServicio, estadoSector.tipoServicio),
          isNull(reportes.finEn),
          eq(reportes.vencido, false),
        ),
      );
    const activos = await this.db
      .select({ sectorId: estadoSector.sectorId, tipoServicio: estadoSector.tipoServicio })
      .from(estadoSector)
      .where(
        or(
          gt(estadoSector.reportesSinConfirmar, 0),
          and(eq(estadoSector.estado, EstadoServicio.SinServicio), notExists(reporteVivo)),
        ),
      );
    const unicos = new Map(
      [...activos, ...vencidos].map((p) => [`${p.sectorId}/${p.tipoServicio}`, p]),
    );
    const pares = [...unicos.values()];
    for (const { sectorId, tipoServicio } of pares) {
      try {
        await this.db.transaction((tx) => this.reevaluar(tx, sectorId, tipoServicio));
      } catch (e) {
        this.log.error(
          `No se pudo reevaluar el sector ${sectorId} (${tipoServicio}): ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
    return pares.length;
  }

  /**
   * Recálculo al leer (PLAN §6.3): si el par puede tener un estado viejo, lo reevalúa. Sirve cuando
   * el cron no corrió (Render gratis se duerme). Puede estarlo si acaba de perder reportes por
   * vencimiento, si muestra reportes sin confirmar (la ventana pudo vencer) o si tiene un evento
   * abierto sin ningún reporte vivo (T-050).
   */
  async refrescarSiViejo(sectorId: number, tipoServicio: TipoServicio): Promise<void> {
    const vencidos = await this.vencerReportes({ sectorId, tipoServicio });
    const [actual] = await this.db
      .select({
        sinConfirmar: estadoSector.reportesSinConfirmar,
        estado: estadoSector.estado,
      })
      .from(estadoSector)
      .where(and(eq(estadoSector.sectorId, sectorId), eq(estadoSector.tipoServicio, tipoServicio)))
      .limit(1);
    if (!actual) return;
    const puedeEstarViejo =
      vencidos.length > 0 ||
      actual.sinConfirmar > 0 ||
      (actual.estado === EstadoServicio.SinServicio &&
        !(await this.tieneReporteVivo(sectorId, tipoServicio)));
    if (!puedeEstarViejo) return;
    await this.db.transaction((tx) => this.reevaluar(tx, sectorId, tipoServicio));
  }

  private async tieneReporteVivo(sectorId: number, tipoServicio: TipoServicio): Promise<boolean> {
    const [fila] = await this.db
      .select({ id: reportes.id })
      .from(reportes)
      .where(
        and(
          eq(reportes.sectorId, sectorId),
          eq(reportes.tipoServicio, tipoServicio),
          isNull(reportes.finEn),
          eq(reportes.vencido, false),
        ),
      )
      .limit(1);
    return fila !== undefined;
  }

  /** Recalcula el estado del par (sector, servicio): abre o cierra el evento y actualiza `estado_sector`. */
  async reevaluar(tx: Transaccion, sectorId: number, tipoServicio: TipoServicio): Promise<void> {
    // Serializa los reportes concurrentes del mismo par (CON-03). El bloqueo se suelta al terminar la
    // transacción; el índice único parcial de `eventos_sector` es la segunda barrera.
    await tx.execute(
      sql`select pg_advisory_xact_lock(${sectorId}::int, ${TIPOS_SERVICIO.indexOf(tipoServicio)}::int)`,
    );

    const ahora = this.reloj();
    const n = this.config.get('CONSENSO_N', { infer: true });
    const ventanaMin = this.config.get(
      tipoServicio === 'agua' ? 'CONSENSO_VENTANA_MIN_AGUA' : 'CONSENSO_VENTANA_MIN_ELECTRICIDAD',
      { infer: true },
    );

    const [abierto] = await tx
      .select()
      .from(eventosSector)
      .where(
        and(
          eq(eventosSector.sectorId, sectorId),
          eq(eventosSector.tipoServicio, tipoServicio),
          isNull(eventosSector.finEn),
          eq(eventosSector.incompleto, false),
        ),
      )
      .limit(1);

    const delPar = and(eq(reportes.sectorId, sectorId), eq(reportes.tipoServicio, tipoServicio));
    const abiertos = await tx
      .select({ residenteId: reportes.residenteId, inicioEn: reportes.inicioEn })
      .from(reportes)
      .where(and(delPar, isNull(reportes.finEn), eq(reportes.vencido, false)));

    let deseado: EstadoDeseado;
    if (!abierto) {
      const inicio = evaluarInicio(abiertos, { n, ventanaMin, ahora });
      if (inicio.confirmado && inicio.inicioEvento) {
        const [evento] = await tx
          .insert(eventosSector)
          .values({ sectorId, tipoServicio, inicioEn: inicio.inicioEvento, confirmadoEn: ahora })
          .returning({ id: eventosSector.id });
        deseado = {
          estado: EstadoServicio.SinServicio,
          reportesSinConfirmar: 0,
          eventoId: evento.id,
          desde: inicio.inicioEvento,
        };
      } else {
        deseado = {
          estado: EstadoServicio.ConServicio,
          reportesSinConfirmar: inicio.sinConfirmar,
          eventoId: null,
          desde: null,
        };
      }
    } else {
      const cerrados = await tx
        .select({ residenteId: reportes.residenteId, finEn: reportes.finEn })
        .from(reportes)
        .where(and(delPar, isNotNull(reportes.finEn)));
      const cierre = evaluarRestablecimiento(
        cerrados.flatMap((c) => (c.finEn ? [{ residenteId: c.residenteId, finEn: c.finEn }] : [])),
        { n, ventanaMin, inicioEvento: abierto.inicioEn, reportesAbiertos: abiertos.length },
      );
      if (cierre.motivo === 'incompleto') {
        // Todos los reportes vencieron sin ningún cierre (T-050, D-024): el evento termina sin
        // `fin_en`, fuera de la mediana. El mapa vuelve a «con servicio» sin un `desde`: no se sabe
        // cuándo volvió.
        await tx
          .update(eventosSector)
          .set({ incompleto: true, restablecidoEn: ahora })
          .where(eq(eventosSector.id, abierto.id));
        deseado = {
          estado: EstadoServicio.ConServicio,
          reportesSinConfirmar: 0,
          eventoId: null,
          desde: null,
        };
      } else if (cierre.cerrado && cierre.finEvento) {
        await tx
          .update(eventosSector)
          .set({ finEn: cierre.finEvento, restablecidoEn: ahora })
          .where(eq(eventosSector.id, abierto.id));
        deseado = {
          estado: EstadoServicio.ConServicio,
          reportesSinConfirmar: evaluarInicio(abiertos, { n, ventanaMin, ahora }).sinConfirmar,
          eventoId: null,
          desde: cierre.finEvento,
        };
      } else {
        // El corte sigue: ya está confirmado, así que no hay nada "sin confirmar".
        deseado = {
          estado: EstadoServicio.SinServicio,
          reportesSinConfirmar: 0,
          eventoId: abierto.id,
          desde: abierto.inicioEn,
        };
      }
    }

    await this.guardarEstado(tx, sectorId, tipoServicio, deseado, ahora);
  }

  /** Upsert de `estado_sector` que solo escribe si algo cambió, para no disparar Realtime en vano. */
  private async guardarEstado(
    tx: Transaccion,
    sectorId: number,
    tipoServicio: TipoServicio,
    d: EstadoDeseado,
    ahora: Date,
  ): Promise<void> {
    const [actual] = await tx
      .select()
      .from(estadoSector)
      .where(and(eq(estadoSector.sectorId, sectorId), eq(estadoSector.tipoServicio, tipoServicio)))
      .limit(1);

    const igual =
      actual &&
      actual.estado === d.estado &&
      actual.reportesSinConfirmar === d.reportesSinConfirmar &&
      actual.eventoId === d.eventoId &&
      actual.desde?.getTime() === d.desde?.getTime();
    if (igual) return;

    const valores = { ...d, actualizadoEn: ahora };
    await tx
      .insert(estadoSector)
      .values({ sectorId, tipoServicio, ...valores })
      .onConflictDoUpdate({
        target: [estadoSector.sectorId, estadoSector.tipoServicio],
        set: valores,
      });
  }
}
