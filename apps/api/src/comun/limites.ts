/** Límites de seguridad de la API (T-051, D-044). Los comparten `configurar-app.ts`, `AppModule` y los controladores. */

/** Tamaño máximo del body JSON. Un reporte pesa menos de 1 kB; esto deja margen y corta el abuso. */
export const LIMITE_BODY = '16kb';

const MINUTO = 60_000;

/**
 * Throttle por ruta y por minuto. Con sesión cuenta por residente y sin sesión por IP (lo decide
 * `GuardLimites`). Las rutas sin el suyo (hoy solo `/salud`) usan el general de `AppModule`.
 */

/** General: `/salud` (el keepalive pasa cada 10 min) y cualquier ruta nueva que no declare el suyo. */
export const THROTTLE_GENERAL = { limit: 100, ttl: MINUTO };

/**
 * Con sesión, por residente. La escritura deja vaciar de un golpe la cola offline al volver la red
 * (OFF-04): 10 a 20 avisos pendientes, cada uno con su inicio y su cierre en rutas distintas.
 */
export const THROTTLE_ESCRITURA = { default: { limit: 60, ttl: MINUTO } };
export const THROTTLE_LECTURA = { default: { limit: 120, ttl: MINUTO } };
/** El registro se hace una sola vez por residente: pocos intentos bastan (y es idempotente). */
export const THROTTLE_REGISTRO = { default: { limit: 5, ttl: MINUTO } };

/**
 * Sin sesión, por IP. Muchos vecinos pueden compartir una IP (el CGNAT de las operadoras móviles,
 * el Wi-Fi de una prueba de campo), así que las lecturas públicas son holgadas. `validar-pin` cuesta
 * dos consultas de PostGIS y es lo más caro que se puede pedir sin cuenta: 30 alcanzan para que
 * 10 vecinos se registren juntos en la misma red moviendo el pin un par de veces.
 */
export const THROTTLE_LECTURA_PUBLICA = { default: { limit: 300, ttl: MINUTO } };
export const THROTTLE_VALIDAR_PIN = { default: { limit: 30, ttl: MINUTO } };

/** Texto del 429; el filtro le agrega `codigo: DEMASIADAS_SOLICITUDES`. */
export const MENSAJE_LIMITE = 'Demasiadas solicitudes. Espera un momento y vuelve a intentarlo.';
