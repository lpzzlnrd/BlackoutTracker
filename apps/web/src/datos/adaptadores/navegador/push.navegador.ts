import { aSolicitud, claveABytes, esIOS, estadoPush, mismaClave } from '../../../dominio/push';
import type { PushDispositivo } from '../../puertos';

/**
 * Web Push del navegador: `Notification` para el permiso y el `pushManager` del service worker
 * para la suscripción. En desarrollo y en la demo no hay service worker registrado: entonces
 * `suscribir` falla y la interfaz lo dice, en vez de quedarse esperando a `serviceWorker.ready`.
 */
export function crearPushNavegador(): PushDispositivo {
  const soportaPush = () =>
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

  async function registro(): Promise<ServiceWorkerRegistration> {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) throw new Error('No hay service worker registrado.');
    return reg;
  }

  async function suscripcionActual(): Promise<PushSubscription | null> {
    if (!soportaPush()) return null;
    const reg = await navigator.serviceWorker.getRegistration();
    return (await reg?.pushManager.getSubscription()) ?? null;
  }

  return {
    estado: () =>
      estadoPush({
        soportaPush: soportaPush(),
        permiso: 'Notification' in window ? Notification.permission : 'default',
        ios: esIOS(navigator),
        instalada: matchMedia('(display-mode: standalone)').matches,
      }),

    async actual() {
      const sub = await suscripcionActual();
      return sub ? aSolicitud(sub.toJSON()) : null;
    },

    async suscribir(clavePublica) {
      if (!soportaPush()) return null;
      const permiso = await Notification.requestPermission();
      if (permiso !== 'granted') return null;
      const reg = await registro();
      const clave = claveABytes(clavePublica);
      let sub = await reg.pushManager.getSubscription();
      if (sub && !mismaClave(sub.options.applicationServerKey, clave)) {
        await sub.unsubscribe();
        sub = null;
      }
      sub ??= await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: clave,
      });
      return aSolicitud(sub.toJSON());
    },

    async anular() {
      const sub = await suscripcionActual();
      if (!sub) return null;
      const { endpoint } = sub;
      await sub.unsubscribe();
      return endpoint;
    },
  };
}
