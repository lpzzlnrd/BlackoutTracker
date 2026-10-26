import type { EstadoSectorFila } from '@blackout/shared';
import type { EstadoSector } from './tipos';

/** La fila de `estado_sector` llega de Supabase en snake_case; el resto de la app usa camelCase. */
export function desdeFila(fila: EstadoSectorFila): EstadoSector {
  return {
    sectorId: fila.sector_id,
    tipoServicio: fila.tipo_servicio,
    estado: fila.estado,
    reportesSinConfirmar: fila.reportes_sin_confirmar,
    desde: fila.desde,
    actualizadoEn: fila.actualizado_en,
  };
}
