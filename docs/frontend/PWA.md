# Canon del frontend · PWA

> Aplica a las tres propuestas. El stack es el de [`CLAUDE.md`](../../CLAUDE.md) §4: `vite-plugin-pwa` en modo `injectManifest` con un service worker propio, Dexie para la cola sin conexión, TanStack Query para los datos del servidor.
> Lo que está **comprobado en este repo** (tokens, referencias, formatos) se dice sin reservas; lo que depende de probar en dispositivos reales (sobre todo **Safari en iOS**) lleva la marca _verificar_.

## 1. Qué tiene que cumplir

Del proyecto ([`CLAUDE.md`](../../CLAUDE.md) §2 y §7):

- Funcionar con conectividad **intermitente o lenta** (NF-01) y desde el navegador del móvil, sin instalar nada (NF-02).
- **Usable en 8 s con 3G lenta, y en 3 s con caché.** Pasar la auditoría PWA de Lighthouse en Chrome Android, Firefox y Safari iOS.
- Cola persistente en **IndexedDB**, nunca en memoria; se sincroniza con el evento `online` y, como mejora, con Background Sync (OFF-06).
- Sin red, la app muestra la última información guardada con el aviso "datos no actualizados" (OFF-07).

## 2. Manifest

`vite-plugin-pwa` lo genera a partir de su configuración. Valores (el color depende de la propuesta: es su `--fondo` claro):

```json
{
  "id": "/",
  "name": "BlackoutTracker",
  "short_name": "Blackout",
  "description": "Cortes de agua y luz en Guaparo, reportados por los vecinos.",
  "lang": "es-VE",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#f8fafc",
  "theme_color": "#f8fafc",
  "icons": [
    { "src": "/pwa-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/pwa-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/pwa-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "shortcuts": [
    { "name": "Reportar", "url": "/reportar", "icons": [{ "src": "/pwa-192.png", "sizes": "192x192" }] }
  ]
}
```

| Propuesta | `background_color` y `theme_color` (claro) | `theme_color` en oscuro (meta) |
| --------- | ------------------------------------------ | ------------------------------ |
| A         | `#f8fafc`                                  | `#0b1220`                      |
| B         | `#f7f5f2`                                  | `#12100e`                      |
| C         | `#fafafa`                                  | `#09090b`                      |

- `short_name` corto (8 caracteres) para que Android no lo recorte en el lanzador.
- El manifest **no** admite `theme_color` distinto en oscuro: se resuelve con las dos etiquetas `<meta name="theme-color">` de §5.
- `display: standalone`: la app se abre sin la barra del navegador. Sin `orientation` (no se fuerza ninguna).

## 3. Iconos

Los tres iconos base están en [`referencia/icono-a.svg`](referencia/icono-a.svg), `icono-b.svg` e `icono-c.svg`: 512 × 512, fondo del color de la propuesta a sangre y el pin con el rayo centrado a **72 % del alto**, dentro de la zona segura de un icono _maskable_ (verificado con máscara circular y con esquinas redondeadas, y legible a 32 px).

**Desde D-038** la app usa [`apps/web/public/icono.svg`](../../apps/web/public/icono.svg): la tinta (`#0b1220`) a sangre y el rayo blanco de la marca al **70 % del alto**, también dentro de la zona segura. Los cuatro PNG se renderizan de ese SVG en Chromium a los tamaños de la tabla.

| Archivo                  | Tamaño       | Uso                                                         |
| ------------------------ | ------------ | ----------------------------------------------------------- |
| `pwa-192.png`            | 192 × 192    | Manifest                                                    |
| `pwa-512.png`            | 512 × 512    | Manifest                                                    |
| `pwa-maskable-512.png`   | 512 × 512    | Manifest, `purpose: "maskable"`                             |
| `apple-touch-icon.png`   | 180 × 180    | iOS (cuadrado, **sin transparencia**: iOS aplica su máscara) |
| `icono.svg`              | vectorial    | `<link rel="icon" type="image/svg+xml">`                    |

Para generar los PNG desde el SVG se puede usar `@vite-pwa/assets-generator` (de la misma familia que el plugin) _(verificar su configuración vigente)_; sirve igual cualquier herramienta que exporte el SVG a PNG sin cambiar el fondo.

## 4. Service worker

Es propio (`src/pwa/sw.ts`) y usa Workbox (`workbox-precaching`, `workbox-routing`, `workbox-strategies`, `workbox-expiration`). `vite-plugin-pwa`:

```ts
VitePWA({
  strategies: 'injectManifest',
  srcDir: 'src/pwa',
  filename: 'sw.ts',
  registerType: 'prompt', // las versiones nuevas se ofrecen, no se imponen
  injectRegister: false,  // se registra a mano con virtual:pwa-register
  manifest: { /* §2 */ },
});
```

### Qué se guarda y cómo

| Qué                                                             | Estrategia                                                      | Notas                                                                                                         |
| --------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Cascarón de la app (HTML, JS, CSS, SVG, PNG, fuentes `woff2`)   | **Precaché** (`precacheAndRoute(self.__WB_MANIFEST)`)           | `cleanupOutdatedCaches()`. Navegaciones: `NavigationRoute` a `/index.html`, **excluyendo `/api`**.            |
| `GET /api/sectores` (GeoJSON)                                   | `StaleWhileRevalidate`                                          | Cambia casi nunca. La API ya envía `Cache-Control: public, max-age=3600`.                                     |
| Lecturas con sesión: `resumen`, `estimaciones`, `historial`, `residentes/me`, `reportes/mios` | `NetworkFirst`, `networkTimeoutSeconds: 3`, con caché de respaldo | Es lo que hace posible "última información guardada" sin red. **Se borran al cerrar sesión** (la caché se indexa por URL, no por usuario). |
| Teselas de OpenStreetMap                                        | `CacheFirst` con `ExpirationPlugin` (`maxEntries` ≈ 300, 30 días) y respuestas 0 y 200 | Limita el almacenamiento. Respeta la [política de teselas de OSM](https://operations.osmfoundation.org/policies/tiles/). |
| Escrituras (`PUT /reportes/:id`, `PATCH …/cierre`)              | **Sin caché**                                                   | Las gestiona la cola de §7.                                                                                   |
| Estado de los sectores (`estado_sector`, por Supabase Realtime) | No se cachea en el SW                                           | La última instantánea se persiste en IndexedDB (§7).                                                          |

### Actualizaciones

1. `registerSW` de `virtual:pwa-register` avisa con `onNeedRefresh` cuando hay una versión nueva esperando.
2. La app muestra el aviso **"Hay una versión nueva de la app · Actualizar"** (B lo dibuja; A y C usan los tokens `--inverso-*`). Un toque llama a `updateSW(true)`.
3. El SW escucha `message` con `{ type: 'SKIP_WAITING' }` y entonces llama a `self.skipWaiting()`. La página recarga al activarse el nuevo SW.
4. No se actualiza en medio de un envío: si la cola tiene avisos en vuelo, el aviso espera a que termine.

## 5. Pantalla y navegador

En `index.html` (colores de la propuesta elegida):

```html
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="theme-color" content="#f8fafc" media="(prefers-color-scheme: light)" />
<meta name="theme-color" content="#0b1220" media="(prefers-color-scheme: dark)" />
<link rel="manifest" href="/manifest.webmanifest" />
<link rel="icon" href="/icono.svg" type="image/svg+xml" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<meta name="apple-mobile-web-app-title" content="Blackout" />
```

- **`viewport-fit=cover`** deja usar toda la pantalla; por eso la navegación inferior suma `env(safe-area-inset-bottom)` ([`CANON.md`](CANON.md) §2). Con `status-bar-style: default`, el contenido empieza bajo la barra de estado y no hace falta el inset superior (en horizontal, con muesca, sí: `env(safe-area-inset-left/right)` en los laterales).
- **`100dvh`**, nunca `100vh`.
- `overscroll-behavior: none` en la raíz, para que el gesto de "tirar para refrescar" del navegador no choque con el mapa y las hojas.
- Si el vecino fuerza el tema desde Cuenta, se actualiza también el `content` de la etiqueta `theme-color` vigente.
- _Verificar en iOS Safari_: modo standalone, barra de estado, teclado sobre los campos y que el mapa no desplace la página.

## 6. Modo oscuro

- La clase `dark` en `<html>` activa los tokens oscuros ([`CANON.md`](CANON.md) §3).
- Por defecto sigue al sistema (`prefers-color-scheme`); en Cuenta, un ajuste "Tema: Sistema · Claro · Oscuro" (guardado en `localStorage`, que aquí es solo una preferencia local).
- Para evitar el destello al cargar, un script mínimo **antes** de la hoja de estilos en `index.html`:

  ```html
  <script>
    (function () {
      try {
        var guardado = localStorage.getItem('tema'); // 'claro' | 'oscuro' | null (sistema)
        var oscuro = guardado ? guardado === 'oscuro' : matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.classList.toggle('dark', oscuro);
      } catch (_) {}
    })();
  </script>
  ```

- El modo oscuro importa en este proyecto: se usa de noche, durante los apagones, y ahorra batería en pantallas OLED.

## 7. Sin conexión

### Estados de la red

| Estado                         | Cómo se detecta                                                                           | Qué se ve                                                                                                          |
| ------------------------------ | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **En línea**                   | `navigator.onLine` y la última petición salió bien                                        | Sin franja (A, B); en escritorio, "En línea · actualizado a las {hora}" (A, B) o "Sincronizado · {hora}" (C)      |
| **Sin conexión**               | Evento `offline`, o una petición que falla por red                                        | Franja **"Sin conexión · datos no actualizados ({hora de la última sincronización})"**; se muestra lo guardado    |
| **Servidor caído** _(no dibujado)_ | Hay red pero la API responde 5xx o agota el tiempo                                    | La misma franja con "No se pudo actualizar · datos de las {hora}"                                                  |
| **Sin nada guardado**          | Primera carga sin red y sin caché                                                         | Estado "Sin datos" ([`CANON.md`](CANON.md) §3)                                                                     |

- `navigator.onLine` puede decir que hay red cuando no hay salida a internet: **no se fía solo de él**. Una petición fallida por red se trata como sin conexión, y mientras dure se sondea `GET /api/salud` con espera creciente para detectar la vuelta.
- **Lo último que se vio sobrevive al cierre del navegador:** se persiste la caché de TanStack Query en IndexedDB (con `@tanstack/react-query-persist-client` y un _persister_ asíncrono sobre Dexie o `idb-keyval`), y la hora de la última sincronización correcta con ella.
- Al volver la red, las consultas se refrescan solas; la franja desaparece cuando la primera petición sale bien.

### Cola de avisos (Dexie)

Cada acción del vecino ("Se fue…", "Volvió…") se escribe **primero en la cola** y se ve de inmediato como _Pendiente_ (el chip y la fila de las maquetas); después se intenta enviar.

- **Contenido de cada aviso:** `id` (UUID generado en el cliente: es la clave de idempotencia, OFF-05), `tipoServicio`, `accion` (`inicio` | `cierre`), `ocurridoEn` (la hora real del evento, OFF-03) y `estado`: `pendiente` | `enviado` | `error` (D-011).
- **Envío:** por orden cronológico de `ocurridoEn` (OFF-04), de uno en uno. Se detiene en el primer fallo reintentable para no desordenar.
- **Cuándo se intenta:** al encolar, con el evento `online`, al abrir la app, al volver a primer plano y con **Background Sync** donde exista (`registration.sync.register('sync-reportes')`; solo Chromium, como mejora).
- **Respuestas** (contrato de [`PLAN.md`](../PLAN.md) §5):

  | Respuesta                                  | Qué hace el cliente                                                                    |
  | ------------------------------------------ | -------------------------------------------------------------------------------------- |
  | 2xx                                        | Marca `enviado`; sale de la lista de pendientes                                        |
  | Red caída, 5xx, 429                        | Reintenta con espera creciente                                                         |
  | 404 en un cierre                           | Reintenta: el inicio todavía puede estar en camino                                     |
  | 400, 409, 422                              | Error permanente: marca `error`, avisa al vecino con un mensaje según el `codigo`      |
  | 401                                        | Renueva la sesión y reintenta                                                          |

- **Lo que se ve:** el botón de pendientes (texto en A y B, icono con insignia en C) y, en la hoja de la cola, un chip por aviso: _Pendiente_, _Enviado_ (se conserva visible unas horas) o _Error_ (con "Reintentar" y "Descartar").
- **Background Sync y la sesión:** el service worker **no puede leer `localStorage`**, donde Supabase guarda la sesión. Si se quiere enviar en segundo plano, la app copia el JWT a IndexedDB cada vez que se renueva; si el token venció, el SW no puede renovarlo y deja la cola intacta hasta que se abra la app. Por eso el evento `online` y la apertura de la app son el mecanismo principal.
- **Cerrar sesión** borra la cola, la caché de consultas y las cachés de lecturas con sesión (§4).

## 8. Fuentes

Se **autoalojan**: ninguna petición a Google Fonts en producción (por velocidad, por funcionar sin red y por privacidad). Con `fontsource`:

| Propuesta | Paquetes                                                                                   | Archivos a importar                                                    |
| --------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| A         | Ninguno (fuente del sistema). **D-038:** `@fontsource-variable/bricolage-grotesque` para títulos y cifras | Solo el `woff2` latino con peso y tamaño óptico (`@font-face` propio en `globales.css`) |
| B         | `@fontsource/atkinson-hyperlegible`                                                        | `latin-400.css`, `latin-700.css`                                       |
| C         | `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono`                                   | Sans: `latin-400.css`, `latin-500.css`, `latin-600.css`; Mono: `latin-400.css`, `latin-500.css` |

El subconjunto `latin` cubre el español (tildes, ñ, ¿, ¡), las comillas « » y la raya. Licencias libres (OFL). Los `woff2` entran al precaché del service worker. `font-display: swap` (viene así en `fontsource`): el texto aparece enseguida con la fuente de respaldo.

## 9. Instalación

- **Chrome y Edge (Android y escritorio):** se captura `beforeinstallprompt`, se guarda el evento y se ofrece un botón propio. En A es la tarjeta "Instalar BlackoutTracker" de la barra lateral; en el teléfono y en B y C, un aviso equivalente _(no dibujado)_ en Cuenta.
- **Safari en iOS:** no existe ese evento. Se muestran instrucciones: "Toca Compartir y luego «Añadir a pantalla de inicio»" _(verificar el texto exacto de iOS en español)_.
- **Cuándo mostrarlo:** solo si la app no está instalada (`matchMedia('(display-mode: standalone)')` y `navigator.standalone`), nunca en la primera visita, y recordando el descarte.
- Tras instalarse (`appinstalled`), el aviso desaparece.

## 10. Rendimiento

El objetivo es el del proyecto: usable en **8 s con 3G lenta** y en **3 s con caché**. Para llegar:

- **Cargar el mapa bajo demanda:** Leaflet, react-leaflet y Turf solo en las pantallas que dibujan un mapa (`React.lazy` por ruta). B puede mostrar su inicio sin el mapa.
- **Fuentes autoalojadas y recortadas** (§8); iconos en SVG en línea; sin imágenes de contenido.
- **Sin saltos de diseño:** todos los bloques tienen su alto reservado mientras cargan (filas y tarjetas de `--superficie-2`).
- **Mediciones:** Lighthouse en móvil (PWA, rendimiento, accesibilidad) y DevTools con "Slow 3G", con y sin caché. Se mide en cada PR que toque el arranque.

## 11. Lista de comprobación PWA

- [ ] Lighthouse: PWA instalable, manifest y service worker válidos; accesibilidad sin fallos.
- [ ] Sin red, la app abre y muestra lo último guardado con la franja y la hora correcta.
- [ ] Un aviso hecho sin red aparece como _Pendiente_ de inmediato y se envía solo al volver la red, **una sola vez** aunque se corte a mitad (OFF-05).
- [ ] La cola sobrevive a cerrar y reabrir el navegador (OFF-06) y se envía en orden cronológico (OFF-04).
- [ ] Se instala en Chrome Android y en Safari iOS (con sus instrucciones) _(verificar)_.
- [ ] El aviso de versión nueva aparece, actualiza y no interrumpe un envío.
- [ ] El modo oscuro no parpadea al cargar y la barra de estado cambia de color con el tema.
- [ ] Cerrar sesión vacía la cola y las cachés con datos del usuario.
- [ ] Cero peticiones a Google Fonts ni a ningún otro tercero salvo las teselas de OpenStreetMap, Supabase y la API.
