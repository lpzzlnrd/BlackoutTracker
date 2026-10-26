import type { FechaIso } from '@blackout/shared';

/**
 * La única fuente de "ahora" de la app. Nadie llama a `Date.now()` directo: el modo demo fija
 * el reloj en las 15:06 de Caracas (CANON §11) y los tests avanzan el tiempo a voluntad.
 */
export interface Reloj {
  ahora(): FechaIso;
}
