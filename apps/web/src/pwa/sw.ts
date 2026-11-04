import { clientsClaim } from 'workbox-core';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import {
  destinoDelClic,
  leerNotificacion,
  NOTIFICACION_GENERICA,
  opcionesDeNotificacion,
  type MensajeNavegar,
} from './notificaciones-sw';

// Service worker propio (PWA.md §4). `vite-plugin-pwa` (injectManifest) sustituye
// `self.__WB_MANIFEST` por la lista de archivos de la build.
declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: (string | { url: string; revision: string | null })[];
};

// Se rutea por `pathname` y no por origen: la API puede estar en otro dominio (Render).
const esApi = (url: URL) => url.pathname.startsWith('/api/');

// Cascarón de la app: precaché. Las navegaciones caen en index.html, salvo las de la API.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//] }),
);

// El contorno de la zona solo cambia con un nuevo seed (la API envía un día de caché).
registerRoute(
  ({ url, request }) => request.method === 'GET' && url.pathname === '/api/zona',
  new StaleWhileRevalidate({ cacheName: 'api-zona' }),
);

// Los sectores aparecen al registrarse el primer vecino de cada hexágono (D-040): red primero, para
// que quien se acaba de registrar vea el suyo, y lo último guardado sin red o si tarda más de 3 s.
registerRoute(
  ({ url, request }) => request.method === 'GET' && url.pathname === '/api/sectores',
  new NetworkFirst({
    cacheName: 'api-sectores',
    networkTimeoutSeconds: 3,
    plugins: [new CacheableResponsePlugin({ statuses: [200] })],
  }),
);

// Lecturas con sesión: red primero y, si tarda más de 3 s o falla, lo último guardado. Es lo que
// permite mostrar "datos no actualizados" sin red. Se borran al cerrar sesión (la caché se
// indexa por URL, no por usuario).
registerRoute(
  ({ url, request }) =>
    request.method === 'GET' &&
    esApi(url) &&
    /^\/api\/(sectores\/\d+\/(resumen|historial)|estimaciones|residentes\/me|reportes\/mios)$/.test(
      url.pathname,
    ),
  new NetworkFirst({
    cacheName: 'api-lecturas',
    networkTimeoutSeconds: 3,
    plugins: [new CacheableResponsePlugin({ statuses: [200] })],
  }),
);

// Teselas de OpenStreetMap: caché con límite, para respetar su política de uso.
registerRoute(
  ({ url }) => url.hostname === 'tile.openstreetmap.org',
  new CacheFirst({
    cacheName: 'teselas-osm',
    plugins: [
      new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 30 * 24 * 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
);

// Las escrituras (`PUT /reportes/:id`, `PATCH …/cierre`) no se cachean: las gestiona la cola.

// ─── Notificaciones push (T-072, D-042) ──────────────────────────────────────────────────────

// Llega cifrado desde la API (Web Push). Siempre se muestra algo: Chrome castiga los push que no
// terminan en una notificación visible (`userVisibleOnly`).
self.addEventListener('push', (evento) => {
  const notificacion = leerNotificacion(leerJson(evento.data));
  if (!notificacion) {
    const { titulo, opciones } = NOTIFICACION_GENERICA;
    evento.waitUntil(self.registration.showNotification(titulo, { ...opciones }));
    return;
  }
  const { titulo, opciones } = opcionesDeNotificacion(notificacion, Date.now());
  evento.waitUntil(self.registration.showNotification(titulo, opciones));
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const destino = destinoDelClic(evento.notification.data, evento.action);
  if (destino) evento.waitUntil(abrirEnLaApp(destino));
});

/** El cuerpo del push como JSON; `null` si no lo es. */
function leerJson(datos: PushMessageData | null): unknown {
  try {
    return datos?.json() ?? null;
  } catch {
    return null;
  }
}

/**
 * Si la app ya está abierta, la trae al frente y le pide que navegue sin recargar (no se pierde
 * lo que el vecino estaba escribiendo); si no, abre una ventana nueva.
 */
async function abrirEnLaApp(ruta: string): Promise<void> {
  const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const propia = ventanas.find((v) => new URL(v.url).origin === self.location.origin);
  if (propia) {
    await propia.focus();
    const mensaje: MensajeNavegar = { tipo: 'navegar', url: ruta };
    propia.postMessage(mensaje);
    return;
  }
  await self.clients.openWindow(new URL(ruta, self.location.origin).href);
}

// La versión nueva espera hasta que la app la acepta (`registerType: 'prompt'`).
self.addEventListener('message', (evento) => {
  if (evento.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});
clientsClaim();
