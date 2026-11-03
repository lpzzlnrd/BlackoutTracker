import type { SectoresGeoJsonDto, ZonaDto } from '@blackout/shared';
import type { RepositorioSectores } from '../../puertos';
import { esperar, type EntornoMock } from './entorno';

/**
 * Sectores y zona en memoria. `geoJson` es el mismo objeto que usa el mock del residente: un
 * registro en una celda nueva le agrega su hexágono, y la siguiente lectura ya lo trae (D-040).
 */
export function crearRepositorioSectoresMock(
  geoJson: SectoresGeoJsonDto,
  zona: ZonaDto,
  entorno: EntornoMock,
): RepositorioSectores {
  return {
    async obtenerGeoJson() {
      await esperar(entorno.latenciaMs);
      return structuredClone(geoJson);
    },
    async obtenerZona() {
      await esperar(entorno.latenciaMs);
      return structuredClone(zona);
    },
  };
}
