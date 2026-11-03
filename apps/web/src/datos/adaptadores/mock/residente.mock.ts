import {
  CodigoError,
  type GeometriaMultiPoligonoDto,
  type PinValidadoDto,
  type SectorAsignadoDto,
  type SectoresGeoJsonDto,
  type ZonaDto,
} from '@blackout/shared';
import { ErrorApiCliente } from '../../../dominio/errores';
import type { RepositorioResidente } from '../../puertos';
import { esperar, exigirRed, type EntornoMock } from './entorno';
import { puntoEnMultiPoligono } from './punto-en-poligono';

export interface ResidenteMock extends RepositorioResidente {
  /** Sector del residente actual, o `null` si todavía no tiene perfil. Lo usa `reportes`. */
  sectorActual(): number | null;
}

/** Lado de la rejilla de la demo, en grados (~1 km): una imitación de las celdas H3. */
const LADO = 0.009;

/**
 * El hexágono de la demo que contiene el pin: su centro es el nodo más cercano de una rejilla
 * fija, así que dos pines vecinos comparten hexágono. La API usa H3 de verdad; aquí solo hace
 * falta algo que se parezca y no dependa de `h3-js` (que no entra en la web).
 */
function hexagonoDemo(lat: number, lng: number): GeometriaMultiPoligonoDto {
  const centroLat = Math.round(lat / LADO) * LADO;
  const centroLng = Math.round(lng / LADO) * LADO;
  const radio = LADO * 0.58;
  const anillo = Array.from({ length: 7 }, (_, i) => {
    const angulo = (Math.PI / 3) * (i % 6) + Math.PI / 6;
    return [centroLng + radio * Math.cos(angulo), centroLat + radio * Math.sin(angulo)];
  });
  return { type: 'MultiPolygon', coordinates: [[anillo]] };
}

/**
 * Registro y perfil en memoria (REG, D-040). `validarPin` comprueba de verdad el punto contra la
 * zona (422 fuera, como la API) y dice en qué sector cae; si no cae en ninguno de la demo, el
 * sector sería nuevo (`sectorId: null`) y `crear` lo agrega a `geoJson`.
 */
export function crearRepositorioResidenteMock(
  geoJson: SectoresGeoJsonDto,
  zona: ZonaDto,
  inicial: SectorAsignadoDto | null,
  entorno: EntornoMock,
): ResidenteMock {
  let perfil = inicial;

  const ubicar = (lat: number, lng: number): PinValidadoDto => {
    if (!puntoEnMultiPoligono(lng, lat, zona.geometry)) {
      throw new ErrorApiCliente(422, CodigoError.PinFueraDeZona);
    }
    const sector = geoJson.features.find((f) => puntoEnMultiPoligono(lng, lat, f.geometry));
    if (sector) {
      return {
        sectorId: sector.properties.id,
        sectorNombre: sector.properties.nombre,
        municipio: sector.properties.municipio,
        geometria: structuredClone(sector.geometry),
      };
    }
    return {
      sectorId: null,
      sectorNombre: 'Sector nuevo',
      municipio: 'Valencia',
      geometria: hexagonoDemo(lat, lng),
    };
  };

  return {
    sectorActual: () => perfil?.sectorId ?? null,
    async validarPin({ lat, lng }) {
      exigirRed(entorno);
      await esperar(entorno.latenciaMs);
      return ubicar(lat, lng);
    },
    async crear({ lat, lng }) {
      exigirRed(entorno);
      await esperar(entorno.latenciaMs);
      if (perfil) throw new ErrorApiCliente(409, CodigoError.ResidenteYaRegistrado);
      const { sectorId, sectorNombre, municipio, geometria } = ubicar(lat, lng);
      if (sectorId !== null) {
        perfil = { sectorId, sectorNombre, municipio };
        return { ...perfil };
      }
      const id = Math.max(0, ...geoJson.features.map((f) => f.properties.id)) + 1;
      const nombre = `${sectorNombre} ${id}`;
      geoJson.features.push({
        type: 'Feature',
        id,
        properties: { id, nombre, municipio },
        geometry: geometria,
      });
      perfil = { sectorId: id, sectorNombre: nombre, municipio };
      return { ...perfil };
    },
    async obtenerMio() {
      await esperar(entorno.latenciaMs);
      if (!perfil) throw new ErrorApiCliente(403, CodigoError.RegistroIncompleto);
      return { ...perfil };
    },
  };
}
