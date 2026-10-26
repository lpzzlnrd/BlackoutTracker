// Contrato de sincronización de la cola offline (docs/PLAN.md §5, OFF-04 y OFF-05): qué hace el
// cliente con cada respuesta de `PUT /reportes/:id` y `PATCH /reportes/:id/cierre`. Es una función
// pura para que el frontend (Dexie) y los tests de la API usen la misma tabla.

/** Qué hace la cola con el envío que acaba de intentar. */
export const AccionCola = {
  /** 2xx: el envío ya está en el servidor; sale de la cola. */
  Exito: 'exito',
  /** Red caída, 5xx, 429 o un cierre cuyo inicio aún no llega: se vuelve a intentar con backoff. */
  Reintentar: 'reintentar',
  /** 400, 409, 422 y el resto de 4xx: reintentar no lo arregla; sale de la cola marcado `error`. */
  ErrorPermanente: 'error_permanente',
  /** 401: se refresca la sesión y se reintenta. */
  RefrescarSesion: 'refrescar_sesion',
} as const;
export type AccionCola = (typeof AccionCola)[keyof typeof AccionCola];

/** Operación de la cola: solo importa distinguir el cierre, porque su 404 se reintenta. */
export type OperacionCola = 'inicio' | 'cierre';

/**
 * `estado` es el código HTTP de la respuesta, o `null` si no hubo respuesta (red caída o corte a
 * mitad del envío). Un 404 en un cierre significa que el inicio todavía no llegó: se reintenta
 * (D-003); en cualquier otra operación es un error permanente. Los reintentos son seguros porque
 * ambas operaciones son idempotentes (OFF-05).
 */
export function accionDeRespuesta(estado: number | null, operacion: OperacionCola): AccionCola {
  if (estado === null) return AccionCola.Reintentar;
  if (estado >= 200 && estado < 300) return AccionCola.Exito;
  if (estado === 401) return AccionCola.RefrescarSesion;
  if (estado === 429 || estado >= 500) return AccionCola.Reintentar;
  if (estado === 404 && operacion === 'cierre') return AccionCola.Reintentar;
  return AccionCola.ErrorPermanente;
}
