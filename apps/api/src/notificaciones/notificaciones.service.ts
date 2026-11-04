import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, isNull } from 'drizzle-orm';
import {
  type ClavePushDto,
  CodigoError,
  type PreferenciasNotificacionesDto,
  type SuscripcionPushSolicitud,
} from '@blackout/shared';
import { ErrorNegocio } from '../comun/error-negocio';
import { RELOJ, type Reloj } from '../comun/reloj';
import type { Env } from '../config/env';
import { type BaseDeDatos, DB } from '../db/db.module';
import { notificaciones, residentes, suscripcionesPush } from '../db/schema';
import { esEndpointPushValido } from './reglas.puro';
import { TRANSPORTE_PUSH, type TransportePush } from './transporte-push';

/** Lo que piden los endpoints de `/notificaciones`: suscripciones, preferencias y aperturas. */
@Injectable()
export class NotificacionesService {
  constructor(
    private readonly config: ConfigService<Env, true>,
    @Inject(RELOJ) private readonly reloj: Reloj,
    @Inject(DB) private readonly db: BaseDeDatos,
    @Inject(TRANSPORTE_PUSH) private readonly transporte: TransportePush,
  ) {}

  clave(): ClavePushDto {
    const clavePublica = this.config.get('VAPID_PUBLIC_KEY', { infer: true }) ?? null;
    return { activo: this.transporte.activo && clavePublica !== null, clavePublica };
  }

  /**
   * Guarda (o reasigna) el dispositivo. Si el mismo navegador cambió de cuenta, la suscripción pasa
   * al vecino actual: un endpoint es de un solo dispositivo. Solo servicios push conocidos (NOT-13).
   */
  async suscribir(residenteId: string, s: SuscripcionPushSolicitud): Promise<void> {
    if (!esEndpointPushValido(s.endpoint)) {
      throw new ErrorNegocio(
        CodigoError.DatosInvalidos,
        'endpoint debe ser de un servicio push de navegador',
      );
    }
    await this.db
      .insert(suscripcionesPush)
      .values({
        endpoint: s.endpoint,
        residenteId,
        p256dh: s.claves.p256dh,
        auth: s.claves.auth,
        creadaEn: this.reloj(),
      })
      .onConflictDoUpdate({
        target: suscripcionesPush.endpoint,
        set: { residenteId, p256dh: s.claves.p256dh, auth: s.claves.auth },
      });
  }

  /** Borra el dispositivo, solo si es del vecino. Si no existe, no pasa nada (idempotente). */
  async darDeBaja(residenteId: string, endpoint: string): Promise<void> {
    await this.db
      .delete(suscripcionesPush)
      .where(
        and(
          eq(suscripcionesPush.endpoint, endpoint),
          eq(suscripcionesPush.residenteId, residenteId),
        ),
      );
  }

  async preferencias(residenteId: string): Promise<PreferenciasNotificacionesDto> {
    const [fila] = await this.db
      .select({ recordatorios: residentes.recordatorios, aguaDeNoche: residentes.aguaDeNoche })
      .from(residentes)
      .where(eq(residentes.id, residenteId))
      .limit(1);
    if (!fila)
      throw new ErrorNegocio(CodigoError.RegistroIncompleto, 'Falta completar el registro');
    return fila;
  }

  async actualizarPreferencias(
    residenteId: string,
    cambios: Partial<PreferenciasNotificacionesDto>,
  ): Promise<PreferenciasNotificacionesDto> {
    const set = Object.fromEntries(
      Object.entries(cambios).filter(([, v]) => typeof v === 'boolean'),
    ) as Partial<PreferenciasNotificacionesDto>;
    if (Object.keys(set).length > 0) {
      await this.db.update(residentes).set(set).where(eq(residentes.id, residenteId));
    }
    return this.preferencias(residenteId);
  }

  /**
   * La app se abrió desde la notificación (`?n=<id>`). Solo marca las del propio vecino y solo la
   * primera vez; con un id ajeno o inexistente no dice nada (no revela si existe).
   */
  async marcarAbierta(residenteId: string, id: string): Promise<void> {
    await this.db
      .update(notificaciones)
      .set({ abiertaEn: this.reloj() })
      .where(
        and(
          eq(notificaciones.id, id),
          eq(notificaciones.residenteId, residenteId),
          isNull(notificaciones.abiertaEn),
        ),
      );
  }
}
