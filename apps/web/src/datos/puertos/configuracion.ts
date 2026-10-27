import type { ConfigCliente } from '../../dominio/tipos';

/** Umbrales de consenso y de estimación (petición P1: hoy salen de `@blackout/shared`). */
export interface Configuracion {
  obtener(): Promise<ConfigCliente>;
}
