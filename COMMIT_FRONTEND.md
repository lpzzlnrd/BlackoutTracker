feat(web): base de la PWA con puertos y adaptadores (F-001)

Estructura la base de apps/web con la propuesta A del canon. Todavía no hay
pantallas: solo la arquitectura, el cableado y una pantalla provisional que
demuestra que todo conecta de punta a punta.

Arquitectura (D-023)
- Capa pura (dominio, aplicacion, utils, datos/puertos y datos/adaptadores/mock)
  sin React, Dexie, TanStack, Supabase ni Workbox. ESLint hace cumplir la
  frontera con no-restricted-imports.
- 12 puertos (reloj, conexión, sonda de salud, configuración, sesión, un
  repositorio por recurso de la API, estado_sector y cola de avisos), armados
  en un solo lugar: datos/componer.ts.
- Un *.mock.ts por puerto. Juntos forman la demo ?demo=en-linea|sin-conexion
  (CANON §11), que se carga con import dinámico y sale en un chunk aparte.
  Los mocks reproducen las reglas de la API: REP-05/06/07, OFF-03/05, REG-02,
  D-003 y D-013.
- Adaptadores reales: cliente HTTP de Nest, Dexie, Supabase (solo Auth y
  Realtime) y navegador.
- Casos de uso: sincronizarCola (orden cronológico, idempotente, se detiene en
  el primer fallo reintentable) y vigilarConexion (sondeo de /salud con espera
  creciente; el evento online corta la espera).

Base técnica
- Vite 8, React 19, TypeScript, Tailwind v4 con los tokens de
  docs/frontend/tokens (importados, no copiados).
- vite-plugin-pwa en injectManifest con service worker propio: precaché,
  lecturas con red primero, teselas de OSM con caducidad.
- TanStack Query con networkMode "always": los puertos ya resuelven el modo
  sin conexión.
- Formateadores del canon (hora, duración, día relativo) con sus tests.

Decisiones tomadas por el camino
- AvisoCola lleva reporteId además de id: un inicio y su cierre pendientes a la
  vez no pueden compartir la clave de la cola.
- En los mocks las lecturas funcionan sin red (las sirve el service worker) y
  solo las escrituras fallan.
- eslint-plugin-react-hooks va en la raíz, donde vive ESLint.
- pnpm-workspace.yaml ignora los scripts de instalación de @parcel/watcher,
  unrs-resolver y @scarf/scarf.

Pruebas: 71 tests en Vitest (OFF-01 a OFF-05, REP-01 a REP-07, REG-01/02,
CON-06, EST-04, VIS-03). Una suite de contrato de la cola corre contra el mock
y contra Dexie (fake-indexeddb) para demostrar que son intercambiables.

Pendiente: iconos PNG de la PWA (pwa-192, pwa-512, pwa-maskable-512 y
apple-touch-icon); el manifest ya los referencia. Nunca se abrió en un
navegador real: falta una pasada manual con ?demo=en-linea.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016MmSVAwRfCLYM4SEox44hP
