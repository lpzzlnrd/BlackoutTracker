import type { PreferenciasNotificacionesDto, SuscripcionPushSolicitud } from '@blackout/shared';
import type { EstadoPush } from '../../../dominio/push';
import type { PushDispositivo, RepositorioNotificaciones } from '../../puertos';
import { esperar, exigirRed, type EntornoMock } from './entorno';

/** El repositorio de la demo, más lo que el servidor "recibió" (para los tests). */
export interface NotificacionesMock extends RepositorioNotificaciones {
  suscripciones(): readonly SuscripcionPushSolicitud[];
  abiertas(): readonly string[];
}

/**
 * Notificaciones en memoria. La clave está activa para que la demo enseñe la oferta y la sección
 * de Cuenta; las escrituras fallan sin red, como la API real.
 */
export function crearRepositorioNotificacionesMock(
  entorno: EntornoMock,
  { activo = true }: { activo?: boolean } = {},
): NotificacionesMock {
  const suscripciones = new Map<string, SuscripcionPushSolicitud>();
  const abiertas: string[] = [];
  let preferencias: PreferenciasNotificacionesDto = { recordatorios: true, aguaDeNoche: false };

  const escribir = async () => {
    await esperar(entorno.latenciaMs);
    exigirRed(entorno);
  };

  return {
    async clave() {
      await esperar(entorno.latenciaMs);
      return { activo, clavePublica: activo ? 'clave-demo' : null };
    },
    async suscribir(solicitud) {
      await escribir();
      suscripciones.set(solicitud.endpoint, solicitud);
    },
    async darDeBaja({ endpoint }) {
      await escribir();
      suscripciones.delete(endpoint);
    },
    async preferencias() {
      await esperar(entorno.latenciaMs);
      return preferencias;
    },
    async cambiarPreferencias(cambios) {
      await escribir();
      preferencias = { ...preferencias, ...cambios };
      return preferencias;
    },
    async marcarAbierta(id) {
      await escribir();
      abiertas.push(id);
    },
    suscripciones: () => [...suscripciones.values()],
    abiertas: () => [...abiertas],
  };
}

/**
 * Un navegador simulado: empieza sin permiso pedido (`pendiente`) y "concede" al suscribirse, o
 * deniega si se crea con `concede: false`. Así la demo y los tests recorren todo el flujo sin
 * service worker.
 */
export function crearPushMock({
  estado: inicial = 'pendiente',
  concede = true,
}: { estado?: EstadoPush; concede?: boolean } = {}): PushDispositivo {
  let estado = inicial;
  let suscripcion: SuscripcionPushSolicitud | null = null;
  let n = 0;
  return {
    estado: () => estado,
    actual: () => Promise.resolve(suscripcion),
    suscribir() {
      if (estado === 'pendiente') estado = concede ? 'concedido' : 'denegado';
      if (estado !== 'concedido') return Promise.resolve(null);
      n += 1;
      suscripcion ??= {
        endpoint: `https://fcm.googleapis.com/fcm/send/demo-${n}`,
        claves: { p256dh: 'p256dh-demo', auth: 'auth-demo' },
      };
      return Promise.resolve(suscripcion);
    },
    anular() {
      const endpoint = suscripcion?.endpoint ?? null;
      suscripcion = null;
      return Promise.resolve(endpoint);
    },
  };
}
