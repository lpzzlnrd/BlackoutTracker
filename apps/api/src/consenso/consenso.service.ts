import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { EstadoServicio, TIPOS_SERVICIO, type TipoServicio } from '@blackout/shared';
import { RELOJ, type Reloj } from '../comun/reloj';
import type { Env } from '../config/env';
import type { Transaccion } from '../db/db.module';
import { estadoSector, eventosSector, reportes } from '../db/schema';
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
  constructor(
    private readonly config: ConfigService<Env, true>,
    @Inject(RELOJ) private readonly reloj: Reloj,
  ) {}

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
      if (cierre.cerrado && cierre.finEvento) {
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
