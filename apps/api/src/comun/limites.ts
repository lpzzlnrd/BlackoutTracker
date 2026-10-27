/** Límites de seguridad de la API (T-051). Los comparten `configurar-app.ts` y los controladores. */

/** Tamaño máximo del body JSON. Un reporte pesa menos de 1 kB; esto deja margen y corta el abuso. */
export const LIMITE_BODY = '16kb';

const MINUTO = 60_000;

/**
 * Throttle por ruta, por IP y por minuto. El general (100/min) está en `AppModule`; `validar-pin`
 * lleva su propio 10/min. La escritura es más alta que la lectura porque la cola offline vacía varios
 * reportes seguidos al volver la red (OFF-04).
 */
export const THROTTLE_ESCRITURA = { default: { limit: 60, ttl: MINUTO } };
export const THROTTLE_LECTURA = { default: { limit: 120, ttl: MINUTO } };
/** El registro se hace una sola vez por residente: pocos intentos bastan. */
export const THROTTLE_REGISTRO = { default: { limit: 5, ttl: MINUTO } };
