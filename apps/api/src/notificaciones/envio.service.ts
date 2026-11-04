import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, asc, count, eq, gte, inArray, isNull, lte, ne, sql } from 'drizzle-orm';
import { gridDisk } from 'h3-js';
import {
  EstadoNotificacion,
  EstadoServicio,
  type NotificacionPushDto,
  TIPOS_RECORDATORIO,
  TipoNotificacion,
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
  sectores,
  suscripcionesPush,
} from '../db/schema';
import { EstimacionService } from '../estimacion/estimacion.service';
import { BandejaService } from './bandeja.service';
import { enSilencio, inicioDelDia, primerMomentoPermitido, topeDiario } from './horario.puro';
import { ImagenSectorService } from './imagen-sector.service';
import { redactar } from './redaccion.puro';
import { resumirActividad } from './reglas.puro';
import { type OpcionesEnvio, TRANSPORTE_PUSH, type TransportePush } from './transporte-push';

/** Una notificación que lleva más que esto esperando ya no se envía: llegaría tarde. */
const CADUCIDAD_MS = 12 * 3_600_000;
/** Notificaciones por pasada del cron: el resto espera al minuto siguiente. */
const LOTE = 100;

type Fila = Awaited<ReturnType<EnvioService['pendientes']>>[number];

/**
 * Envía la bandeja de salida (T-072, D-042). El cron lo llama cada minuto. Cada notificación se
 * revisa justo antes de salir: si ya no tiene sentido (el corte terminó, se pasó el tope diario, el
 * vecino ya reportó…) se descarta. El texto se redacta aquí, con los datos de ese momento.
 */
@Injectable()
export class EnvioService {
  private readonly log = new Logger(EnvioService.name);

  constructor(
    private readonly config: ConfigService<Env, true>,
    @Inject(RELOJ) private readonly reloj: Reloj,
    @Inject(DB) private readonly db: BaseDeDatos,
    @Inject(TRANSPORTE_PUSH) private readonly transporte: TransportePush,
    private readonly estimacion: EstimacionService,
    private readonly bandeja: BandejaService,
    private readonly imagenes: ImagenSectorService,
  ) {}

  /** Una pasada: envía, descarta o aplaza lo vencido. Devuelve cuántas salieron. Sin VAPID no hace nada. */
  async enviarPendientes(): Promise<number> {
    if (!this.transporte.activo) return 0;
    const ahora = this.reloj();
    const filas = await this.pendientes(ahora);
    let enviadas = 0;
    for (const fila of filas) {
      try {
        if (await this.procesar(fila, ahora)) enviadas += 1;
      } catch (e) {
        this.log.error(
          `No se pudo procesar la notificación ${fila.id}: ${e instanceof Error ? e.message : String(e)}`,
        );
        await this.marcar(fila.id, EstadoNotificacion.Fallida);
      }
    }
    return enviadas;
  }

  private pendientes(ahora: Date) {
    return this.db
      .select({
        id: notificaciones.id,
        residenteId: notificaciones.residenteId,
        tipo: notificaciones.tipo,
        sectorId: notificaciones.sectorId,
        tipoServicio: notificaciones.tipoServicio,
        eventoId: notificaciones.eventoId,
        reporteId: notificaciones.reporteId,
        datos: notificaciones.datos,
        programadaPara: notificaciones.programadaPara,
        sectorNombre: sectores.nombre,
        celdaH3: sectores.celdaH3,
        recordatorios: residentes.recordatorios,
        aguaDeNoche: residentes.aguaDeNoche,
      })
      .from(notificaciones)
      .innerJoin(sectores, eq(sectores.id, notificaciones.sectorId))
      .innerJoin(residentes, eq(residentes.id, notificaciones.residenteId))
      .where(
        and(
          eq(notificaciones.estado, EstadoNotificacion.Pendiente),
          lte(notificaciones.programadaPara, ahora),
        ),
      )
      .orderBy(asc(notificaciones.programadaPara), asc(notificaciones.creadaEn))
      .limit(LOTE);
  }

  /** `true` si salió hacia al menos un dispositivo. */
  private async procesar(f: Fila, ahora: Date): Promise<boolean> {
    if (ahora.getTime() - f.programadaPara.getTime() > CADUCIDAD_MS) {
      await this.marcar(f.id, EstadoNotificacion.Descartada);
      return false;
    }
    // Lo que se programó a las 21:59 y el cron toma a las 22:00 también espera a las 07:00.
    const silencio = this.bandeja.silencio();
    const aguaDeNoche =
      f.tipo === TipoNotificacion.ServicioRestablecido &&
      f.tipoServicio === 'agua' &&
      f.aguaDeNoche;
    if (enSilencio(ahora, silencio) && !aguaDeNoche) {
      await this.db
        .update(notificaciones)
        .set({ programadaPara: primerMomentoPermitido(ahora, silencio) })
        .where(eq(notificaciones.id, f.id));
      return false;
    }

    const mensaje = await this.preparar(f, ahora);
    if (!mensaje) {
      await this.marcar(f.id, EstadoNotificacion.Descartada);
      return false;
    }

    const destinos = await this.db
      .select({
        endpoint: suscripcionesPush.endpoint,
        p256dh: suscripcionesPush.p256dh,
        auth: suscripcionesPush.auth,
      })
      .from(suscripcionesPush)
      .where(eq(suscripcionesPush.residenteId, f.residenteId));
    if (destinos.length === 0) {
      await this.marcar(f.id, EstadoNotificacion.Descartada);
      return false;
    }

    const opciones = opcionesDe(mensaje);
    const resultados = await Promise.all(
      destinos.map(async (d) => ({ d, r: await this.transporte.enviar(d, mensaje, opciones) })),
    );
    const caducadas = resultados.filter((x) => x.r === 'caducada').map((x) => x.d.endpoint);
    if (caducadas.length > 0) {
      await this.db.delete(suscripcionesPush).where(inArray(suscripcionesPush.endpoint, caducadas));
    }
    const aceptadas = resultados.filter((x) => x.r === 'enviada').map((x) => x.d.endpoint);
    if (aceptadas.length === 0) {
      await this.marcar(
        f.id,
        caducadas.length === destinos.length
          ? EstadoNotificacion.Descartada
          : EstadoNotificacion.Fallida,
      );
      return false;
    }
    await this.db
      .update(suscripcionesPush)
      .set({ usadaEn: ahora })
      .where(inArray(suscripcionesPush.endpoint, aceptadas));
    await this.db
      .update(notificaciones)
      .set({ estado: EstadoNotificacion.Enviada, enviadaEn: ahora })
      .where(eq(notificaciones.id, f.id));
    return true;
  }

  private marcar(id: string, estado: EstadoNotificacion) {
    return this.db.update(notificaciones).set({ estado }).where(eq(notificaciones.id, id));
  }

  /** El mensaje listo para salir, o `null` si ya no tiene sentido enviarlo. */
  private async preparar(f: Fila, ahora: Date): Promise<NotificacionPushDto | null> {
    if (TIPOS_RECORDATORIO.includes(f.tipo) && !(await this.cabeRecordatorio(f, ahora))) {
      return null;
    }
    const base = {
      id: f.id,
      tipo: f.tipo,
      sectorId: f.sectorId,
      sectorNombre: f.sectorNombre,
      tipoServicio: f.tipoServicio,
      ahora,
    };
    switch (f.tipo) {
      case TipoNotificacion.CorteConfirmado:
      case TipoNotificacion.ServicioRestablecido: {
        if (!f.eventoId || !f.tipoServicio) return null;
        const [evento] = await this.db
          .select()
          .from(eventosSector)
          .where(eq(eventosSector.id, f.eventoId))
          .limit(1);
        if (!evento) return null;
        const confirmado = f.tipo === TipoNotificacion.CorteConfirmado;
        // Si el corte ya terminó, «se fue» sobra: la de «volvió» lleva la misma etiqueta (NOT-17).
        if (confirmado && (evento.finEn !== null || evento.incompleto)) return null;
        if (!confirmado && evento.finEn === null) return null;
        return redactar({
          ...base,
          evento: { inicioEn: evento.inicioEn, finEn: evento.finEn },
          vecinos: f.datos.vecinos,
          aporto: f.datos.aporto,
          estimacion: await this.estimacion.estimar(f.sectorId, f.tipoServicio),
          vecinosSinServicio: confirmado
            ? await this.vecinosSinServicio(f.celdaH3, f.tipoServicio)
            : undefined,
          deNoche: enSilencio(ahora, this.bandeja.silencio()),
          imagen: this.imagenes.url(f.sectorId, f.tipoServicio, ahora),
        });
      }
      case TipoNotificacion.PreguntaVecinos: {
        if (!f.tipoServicio) return null;
        const [estado] = await this.db
          .select()
          .from(estadoSector)
          .where(
            and(
              eq(estadoSector.sectorId, f.sectorId),
              eq(estadoSector.tipoServicio, f.tipoServicio),
            ),
          )
          .limit(1);
        const sigueSinConfirmar =
          estado?.estado === EstadoServicio.ConServicio && estado.reportesSinConfirmar > 0;
        if (!sigueSinConfirmar) return null;
        if (await this.tieneReporteVivo(f.residenteId, f.tipoServicio)) return null;
        return redactar(base);
      }
      case TipoNotificacion.ReporteAbierto: {
        if (!f.reporteId) return null;
        const [reporte] = await this.db
          .select({ inicioEn: reportes.inicioEn, finEn: reportes.finEn, vencido: reportes.vencido })
          .from(reportes)
          .where(eq(reportes.id, f.reporteId))
          .limit(1);
        if (!reporte || reporte.finEn !== null || reporte.vencido) return null;
        return redactar({ ...base, reporteInicioEn: reporte.inicioEn });
      }
      case TipoNotificacion.ResumenDia: {
        const actividad = await this.actividadDelDia(f.sectorId, ahora);
        return actividad.length > 0 ? redactar({ ...base, actividad }) : null;
      }
    }
  }

  /** Tope diario (NOT-08): los recordatorios enviados hoy, más este, no pasan del número de franjas. */
  private async cabeRecordatorio(f: Fila, ahora: Date): Promise<boolean> {
    if (!f.recordatorios) return false;
    const tope = topeDiario(
      this.config.get('RECORDATORIOS_HORAS', { infer: true }),
      this.bandeja.silencio(),
    );
    const [{ enviados }] = await this.db
      .select({ enviados: count() })
      .from(notificaciones)
      .where(
        and(
          eq(notificaciones.residenteId, f.residenteId),
          inArray(notificaciones.tipo, [...TIPOS_RECORDATORIO]),
          eq(notificaciones.estado, EstadoNotificacion.Enviada),
          gte(notificaciones.enviadaEn, inicioDelDia(ahora)),
          ne(notificaciones.id, f.id),
        ),
      );
    return enviados < tope;
  }

  private async tieneReporteVivo(
    residenteId: string,
    tipoServicio: TipoServicio,
  ): Promise<boolean> {
    const [fila] = await this.db
      .select({ id: reportes.id })
      .from(reportes)
      .where(
        and(
          eq(reportes.residenteId, residenteId),
          eq(reportes.tipoServicio, tipoServicio),
          isNull(reportes.finEn),
          eq(reportes.vencido, false),
        ),
      )
      .limit(1);
    return fila !== undefined;
  }

  /**
   * Sectores vecinos (el anillo H3 de distancia 1, hasta 6 hexágonos) sin el servicio ahora mismo.
   * Responde «¿es solo aquí o es toda la zona?» (D-042, idea b). Solo cuenta sectores, nunca personas.
   */
  private async vecinosSinServicio(celdaH3: string, tipoServicio: TipoServicio): Promise<number> {
    const anillo = gridDisk(celdaH3, 1).filter((c) => c !== celdaH3);
    const [{ n }] = await this.db
      .select({ n: count() })
      .from(estadoSector)
      .innerJoin(sectores, eq(sectores.id, estadoSector.sectorId))
      .where(
        and(
          inArray(sectores.celdaH3, anillo),
          eq(estadoSector.tipoServicio, tipoServicio),
          eq(estadoSector.estado, EstadoServicio.SinServicio),
        ),
      );
    return n;
  }

  async actividadDelDia(sectorId: number, ahora: Date) {
    const hoy = inicioDelDia(ahora);
    const eventos = await this.db
      .select({
        tipoServicio: eventosSector.tipoServicio,
        inicioEn: eventosSector.inicioEn,
        finEn: eventosSector.finEn,
        confirmadoEn: eventosSector.confirmadoEn,
        incompleto: eventosSector.incompleto,
      })
      .from(eventosSector)
      .where(
        and(
          eq(eventosSector.sectorId, sectorId),
          eq(eventosSector.origen, 'consenso'),
          sql`(${eventosSector.confirmadoEn} >= ${hoy.toISOString()}::timestamptz or (${eventosSector.finEn} is null and not ${eventosSector.incompleto}))`,
        ),
      );
    return resumirActividad(eventos, hoy);
  }
}

/**
 * Cuánto guarda el servicio push el mensaje si el teléfono está sin red, y con qué prioridad. Un
 * corte vale 6 h y despierta al teléfono; un recordatorio, 2 h y prioridad normal.
 */
export function opcionesDe(m: NotificacionPushDto): OpcionesEnvio {
  const esCorte =
    m.tipo === TipoNotificacion.CorteConfirmado || m.tipo === TipoNotificacion.ServicioRestablecido;
  return {
    ttlSeg: esCorte ? 6 * 3600 : 2 * 3600,
    urgencia: esCorte ? 'high' : 'normal',
    tema: m.etiqueta,
  };
}
