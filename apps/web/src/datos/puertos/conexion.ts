import type { FechaIso } from '@blackout/shared';
import type { Observable } from '../../dominio/observable';
import type { EstadoConexion } from '../../dominio/tipos';

/**
 * Estado de la red tal como lo ve la app (PWA.md §7). No se fía solo de `navigator.onLine`: la
 * capa de datos informa de cada petición buena o fallida y el adaptador decide el modo.
 */
export interface Conexion extends Observable<EstadoConexion> {
  /** Una petición salió bien: vuelve a `en-linea` y guarda la hora. */
  registrarExito(en: FechaIso): void;
  /** Una petición falló: `red` (sin respuesta) o `servidor` (5xx o tiempo agotado). */
  registrarFallo(causa: 'red' | 'servidor'): void;
}

/** `GET /salud`: sondeo con espera creciente para detectar la vuelta de la red. */
export interface SondaSalud {
  /** `true` si la API responde con salud `ok`; nunca lanza. */
  sondear(): Promise<boolean>;
}
