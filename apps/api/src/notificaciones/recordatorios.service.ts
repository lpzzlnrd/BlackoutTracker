import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, desc, eq, gt, gte, inArray, isNull, sql } from 'drizzle-orm';
import {
  EstadoNotificacion,
  EstadoServicio,
  type EstimacionDto,
  TIPOS_RECORDATORIO,
  type TipoServicio,
} from '@blackout/shared';
import { RELOJ, type Reloj } from '../comun/reloj';
import type { Env } from '../config/env';
import { type BaseDeDatos, DB } from '../db/db.module';
import {
  estadoSector,
  eventosSector,
  notificaciones,
  reportes,
  residentes,
  suscripcionesPush,
} from '../db/schema';
import { EstimacionService } from '../estimacion/estimacion.service';
import { BandejaService } from './bandeja.service';
import { franjasIniciadas, inicioDelDia } from './horario.puro';
import {
  elegirRecordatorio,
  PAUSA_TRAS_IGNORADOS,
  type RecordatorioEnviado,
  respetaPausa,
  resumirActividad,
  umbralReporteAbiertoMin,
} from './reglas.puro';

/**
 * Recordatorios (T-072, D-042), la idea de Leonardo con `ultimo_ingreso`: a la hora de una franja
 * (19:00 por defecto), a cada vecino que no entró hoy se le busca algo útil que contar. Si no hay
 * nada, no se le envía nada. El cron lo llama cada 10 min: dentro de la franja, quien ya recibió el
 * suyo no recibe otro (tope diario = número de franjas).
 */
@Injectable()
export class RecordatoriosService {
  constructor(
    private readonly config: ConfigService<Env, true>,
    @Inject(RELOJ) private readonly reloj: Reloj,
    @Inject(DB) private readonly db: BaseDeDatos,
    private readonly estimacion: EstimacionService,
    private readonly bandeja: BandejaService,
  ) {}

  /** Encola los recordatorios de esta franja. Devuelve cuántos encoló (los envía `EnvioService`). */
  async programar(): Promise<number> {
    const ahora = this.reloj();
    const franjas = franjasIniciadas(
      ahora,
      this.config.get('RECORDATORIOS_HORAS', { infer: true }),
      this.bandeja.silencio(),
    );
    if (franjas === null) return 0;
    const hoy = inicioDelDia(ahora);
    const hoyIso = hoy.toISOString();

    // Quien no entró hoy, tiene recordatorios, algún dispositivo y todavía cupo en el día.
    const candidatos = await this.db
      .select({ id: residentes.id, sectorId: residentes.sectorId })
      .from(residentes)
      .where(
        and(
          eq(residentes.recordatorios, true),
          sql`(${residentes.ultimoIngreso} is null or ${residentes.ultimoIngreso} < ${hoyIso}::timestamptz)`,
          sql`exists (select 1 from ${suscripcionesPush} s where s.residente_id = ${residentes.id})`,
          sql`(select count(*) from ${notificaciones} n
               where n.residente_id = ${residentes.id}
                 and n.tipo in ('pregunta_vecinos', 'reporte_abierto', 'resumen_dia')
                 and n.estado in ('pendiente', 'enviada')
                 and n.creada_en >= ${hoyIso}::timestamptz) < ${franjas}`,
        ),
      );
    if (candidatos.length === 0) return 0;
    const ids = candidatos.map((c) => c.id);
    const sectoresIds = [...new Set(candidatos.map((c) => c.sectorId))];

    const enviados = await this.ultimosEnviados(ids);
    const abiertos = await this.db
      .select({
        reporteId: reportes.id,
        residenteId: reportes.residenteId,
        sectorId: reportes.sectorId,
        tipoServicio: reportes.tipoServicio,
        inicioEn: reportes.inicioEn,
      })
      .from(reportes)
      .where(
        and(
          inArray(reportes.residenteId, ids),
          isNull(reportes.finEn),
          eq(reportes.vencido, false),
          // «¿Ya volvió?» se pregunta una sola vez por reporte (NOT-10).
          sql`not exists (select 1 from ${notificaciones} n
                          where n.reporte_id = ${reportes.id} and n.tipo = 'reporte_abierto')`,
        ),
      );
    const eventos = await this.db
      .select({
        sectorId: eventosSector.sectorId,
        tipoServicio: eventosSector.tipoServicio,
        inicioEn: eventosSector.inicioEn,
        finEn: eventosSector.finEn,
        confirmadoEn: eventosSector.confirmadoEn,
        incompleto: eventosSector.incompleto,
      })
      .from(eventosSector)
      .where(
        and(
          inArray(eventosSector.sectorId, sectoresIds),
          eq(eventosSector.origen, 'consenso'),
          sql`(${eventosSector.confirmadoEn} >= ${hoyIso}::timestamptz or (${eventosSector.finEn} is null and not ${eventosSector.incompleto}))`,
        ),
      );
    const sinConfirmar = await this.db
      .select({ sectorId: estadoSector.sectorId, tipoServicio: estadoSector.tipoServicio })
      .from(estadoSector)
      .where(
        and(
          inArray(estadoSector.sectorId, sectoresIds),
          eq(estadoSector.estado, EstadoServicio.ConServicio),
          gt(estadoSector.reportesSinConfirmar, 0),
        ),
      );

    const horasSinEstimacion = this.config.get('RECORDATORIO_REPORTE_ABIERTO_HORAS', {
      infer: true,
    });
    const estimaciones = new Map<string, Promise<EstimacionDto>>();
    const estimar = (sectorId: number, tipoServicio: TipoServicio) => {
      const clave = `${sectorId}/${tipoServicio}`;
      if (!estimaciones.has(clave)) {
        estimaciones.set(clave, this.estimacion.estimar(sectorId, tipoServicio));
      }
      return estimaciones.get(clave) as Promise<EstimacionDto>;
    };

    let encolados = 0;
    for (const c of candidatos) {
      if (!respetaPausa(enviados.get(c.id) ?? [], ahora)) continue;
      const suyos = abiertos.filter((r) => r.residenteId === c.id);
      const eleccion = elegirRecordatorio({
        ahora,
        reportesAbiertos: await Promise.all(
          suyos.map(async (r) => ({
            ...r,
            umbralMin: umbralReporteAbiertoMin(
              await estimar(r.sectorId, r.tipoServicio),
              horasSinEstimacion,
            ),
          })),
        ),
        actividadHoy: resumirActividad(
          eventos.filter((e) => e.sectorId === c.sectorId),
          hoy,
        ),
        sinConfirmar: sinConfirmar
          .filter((s) => s.sectorId === c.sectorId)
          .map((s) => s.tipoServicio),
      });
      if (!eleccion) continue;
      const insertadas = await this.db
        .insert(notificaciones)
        .values({
          residenteId: c.id,
          tipo: eleccion.tipo,
          sectorId: c.sectorId,
          tipoServicio: 'tipoServicio' in eleccion ? eleccion.tipoServicio : null,
          reporteId: 'reporteId' in eleccion ? eleccion.reporteId : null,
          creadaEn: ahora,
          programadaPara: ahora,
        })
        .onConflictDoNothing()
        .returning({ id: notificaciones.id });
      encolados += insertadas.length;
    }
    return encolados;
  }

  /** Los últimos recordatorios enviados a cada vecino, del más reciente al más antiguo (para la pausa). */
  private async ultimosEnviados(ids: string[]): Promise<Map<string, RecordatorioEnviado[]>> {
    const filas = await this.db
      .select({
        residenteId: notificaciones.residenteId,
        enviadaEn: notificaciones.enviadaEn,
        abiertaEn: notificaciones.abiertaEn,
      })
      .from(notificaciones)
      .where(
        and(
          inArray(notificaciones.residenteId, ids),
          inArray(notificaciones.tipo, [...TIPOS_RECORDATORIO]),
          eq(notificaciones.estado, EstadoNotificacion.Enviada),
          gte(notificaciones.enviadaEn, new Date(this.reloj().getTime() - 30 * 86_400_000)),
        ),
      )
      .orderBy(desc(notificaciones.enviadaEn));
    const mapa = new Map<string, RecordatorioEnviado[]>();
    for (const f of filas) {
      if (!f.enviadaEn) continue;
      const lista = mapa.get(f.residenteId) ?? [];
      if (lista.length < PAUSA_TRAS_IGNORADOS) {
        lista.push({ enviadaEn: f.enviadaEn, abierta: f.abiertaEn !== null });
      }
      mapa.set(f.residenteId, lista);
    }
    return mapa;
  }
}
