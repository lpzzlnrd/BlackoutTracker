import { CONSENSO_N_POR_DEFECTO, ESTIMACION_N_MIN_POR_DEFECTO } from '@blackout/shared';
import type { Configuracion } from '../../puertos';

/**
 * Los umbrales por defecto de `@blackout/shared`. Si la API los cambia por variable de entorno
 * (D-006) el texto "2 de 3 reportes" quedaría desfasado: la petición P1 (`GET /configuracion`)
 * lo resuelve y, cuando se decida, solo cambia este adaptador.
 */
export const configuracionEstatica: Configuracion = {
  obtener: async () => ({
    consensoN: CONSENSO_N_POR_DEFECTO,
    estimacionNMin: ESTIMACION_N_MIN_POR_DEFECTO,
  }),
};
