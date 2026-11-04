import type { NotificacionPushDto } from '@blackout/shared';
import type {
  DestinoPush,
  OpcionesEnvio,
  ResultadoEnvio,
  TransportePush,
} from '../src/notificaciones/transporte-push';

export interface EnvioAnotado {
  endpoint: string;
  mensaje: NotificacionPushDto;
  opciones: OpcionesEnvio;
}

/**
 * Transporte push de los tests: nunca sale a la red. Anota lo que se habría enviado y responde lo
 * que se le diga por endpoint (`enviada` si no se le dice nada).
 */
export class TransportePushFalso implements TransportePush {
  activo = true;
  readonly enviados: EnvioAnotado[] = [];
  readonly respuestas = new Map<string, ResultadoEnvio>();

  enviar(destino: DestinoPush, mensaje: NotificacionPushDto, opciones: OpcionesEnvio) {
    this.enviados.push({ endpoint: destino.endpoint, mensaje, opciones });
    return Promise.resolve(this.respuestas.get(destino.endpoint) ?? 'enviada');
  }

  reiniciar(): void {
    this.activo = true;
    this.enviados.length = 0;
    this.respuestas.clear();
  }
}
