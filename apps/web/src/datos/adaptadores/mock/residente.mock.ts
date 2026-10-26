import { CodigoError, type SectoresGeoJsonDto, type SectorAsignadoDto } from '@blackout/shared';
import { ErrorApiCliente } from '../../../dominio/errores';
import type { RepositorioResidente } from '../../puertos';
import { esperar, exigirRed, type EntornoMock } from './entorno';
import { puntoEnMultiPoligono } from './punto-en-poligono';

export interface ResidenteMock extends RepositorioResidente {
  /** Sector del residente actual, o `null` si todavía no tiene perfil. Lo usa `reportes`. */
  sectorActual(): number | null;
}

/**
 * Registro y perfil en memoria. `validarPin` hace de verdad el punto-dentro-de-polígono contra
 * la geometría recibida, así que un pin fuera de Guaparo da el mismo 422 que la API (REG-02).
 */
export function crearRepositorioResidenteMock(
  geoJson: SectoresGeoJsonDto,
  inicial: SectorAsignadoDto | null,
  entorno: EntornoMock,
): ResidenteMock {
  let perfil = inicial;

  const sectorDelPin = (lat: number, lng: number): SectorAsignadoDto => {
    const sector = geoJson.features.find((f) => puntoEnMultiPoligono(lng, lat, f.geometry));
    if (!sector) throw new ErrorApiCliente(422, CodigoError.PinFueraDeGuaparo);
    return { sectorId: sector.properties.id, sectorNombre: sector.properties.nombre };
  };

  return {
    sectorActual: () => perfil?.sectorId ?? null,
    async validarPin({ lat, lng }) {
      exigirRed(entorno);
      await esperar(entorno.latenciaMs);
      return sectorDelPin(lat, lng);
    },
    async crear({ lat, lng }) {
      exigirRed(entorno);
      await esperar(entorno.latenciaMs);
      if (perfil) throw new ErrorApiCliente(409, CodigoError.ResidenteYaRegistrado);
      perfil = sectorDelPin(lat, lng);
      return { ...perfil };
    },
    async obtenerMio() {
      await esperar(entorno.latenciaMs);
      if (!perfil) throw new ErrorApiCliente(403, CodigoError.RegistroIncompleto);
      return { ...perfil };
    },
  };
}
