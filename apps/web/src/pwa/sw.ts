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

// El GeoJSON de sectores casi no cambia (la API envía `Cache-Control: public, max-age=3600`).
registerRoute(
  ({ url, request }) => request.method === 'GET' && url.pathname === '/api/sectores',
  new StaleWhileRevalidate({ cacheName: 'api-sectores' }),
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

// La versión nueva espera hasta que la app la acepta (`registerType: 'prompt'`).
self.addEventListener('message', (evento) => {
  if (evento.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});
clientsClaim();
