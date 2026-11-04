import { navegarAUrl } from '../navegacion/ruta';
import { esMensajeNavegar } from './notificaciones-sw';

/**
 * Al tocar una notificación con la app abierta, el service worker no recarga la pestaña: le pide
 * que navegue (T-072). Sin service worker (desarrollo, demo) no llega nada y no pasa nada.
 */
export function escucharNavegacionDelSw(): void {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.addEventListener('message', (evento: MessageEvent<unknown>) => {
    if (esMensajeNavegar(evento.data)) navegarAUrl(evento.data.url);
  });
}
