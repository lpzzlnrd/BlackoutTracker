import type { SectoresGeoJsonDto } from '@blackout/shared';
import type { RepositorioSectores } from '../../puertos';
import { esperar, type EntornoMock } from './entorno';

export function crearRepositorioSectoresMock(
  geoJson: SectoresGeoJsonDto,
  entorno: EntornoMock,
): RepositorioSectores {
  return {
    async obtenerGeoJson() {
      await esperar(entorno.latenciaMs);
      return structuredClone(geoJson);
    },
  };
}
