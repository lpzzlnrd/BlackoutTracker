import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import webpush, { WebPushError } from 'web-push';
import type { NotificacionPushDto } from '@blackout/shared';
import type { Env } from '../config/env';

/** Token del transporte: los tests lo reemplazan por uno que solo anota lo que se envía. */
export const TRANSPORTE_PUSH = Symbol('TRANSPORTE_PUSH');

export interface DestinoPush {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface OpcionesEnvio {
  /** Segundos que el servicio push guarda el mensaje si el teléfono está apagado o sin red. */
  ttlSeg: number;
  urgencia: 'normal' | 'high';
  /**
   * Cabecera `Topic`: si el teléfono estuvo sin red, el servicio push entrega solo el último mensaje
   * de cada tema. Es la etiqueta del corte, así que "se fue" y "volvió" no llegan los dos tarde.
   */
  tema: string;
}

/** `caducada`: el navegador anuló la suscripción (404/410) y hay que borrarla. */
export type ResultadoEnvio = 'enviada' | 'caducada' | 'error';

export interface TransportePush {
  readonly activo: boolean;
  enviar(
    destino: DestinoPush,
    mensaje: NotificacionPushDto,
    op: OpcionesEnvio,
  ): Promise<ResultadoEnvio>;
}

/**
 * Web Push con VAPID (`web-push`, MIT). El mensaje va cifrado con las claves del navegador: FCM,
 * Mozilla o Apple solo transportan bytes que no pueden leer. Sin claves VAPID queda inactivo.
 */
@Injectable()
export class WebPushTransporte implements TransportePush {
  private readonly log = new Logger(WebPushTransporte.name);
  private readonly vapid: { subject: string; publicKey: string; privateKey: string } | null;

  constructor(config: ConfigService<Env, true>) {
    const publicKey = config.get('VAPID_PUBLIC_KEY', { infer: true });
    const privateKey = config.get('VAPID_PRIVATE_KEY', { infer: true });
    this.vapid =
      publicKey && privateKey
        ? { subject: config.get('VAPID_SUBJECT', { infer: true }), publicKey, privateKey }
        : null;
  }

  get activo(): boolean {
    return this.vapid !== null;
  }

  async enviar(
    destino: DestinoPush,
    mensaje: NotificacionPushDto,
    op: OpcionesEnvio,
  ): Promise<ResultadoEnvio> {
    if (!this.vapid) return 'error';
    try {
      await webpush.sendNotification(
        { endpoint: destino.endpoint, keys: { p256dh: destino.p256dh, auth: destino.auth } },
        JSON.stringify(mensaje),
        {
          vapidDetails: this.vapid,
          TTL: op.ttlSeg,
          urgency: op.urgencia,
          topic: op.tema,
          timeout: 10_000,
        },
      );
      return 'enviada';
    } catch (e) {
      if (e instanceof WebPushError && (e.statusCode === 404 || e.statusCode === 410)) {
        return 'caducada';
      }
      // Nunca se registra el endpoint: identifica al dispositivo.
      const estado = e instanceof WebPushError ? ` (HTTP ${e.statusCode})` : '';
      this.log.warn(`El servicio push rechazó un envío${estado}`);
      return 'error';
    }
  }
}
