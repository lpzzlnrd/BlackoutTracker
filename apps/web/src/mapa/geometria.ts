import type { SectorFeatureDto } from '@blackout/shared';
import { booleanPointInPolygon } from '@turf/boolean-point-in-polygon';
import { centerOfMass } from '@turf/center-of-mass';
import { pointOnFeature } from '@turf/point-on-feature';

/**
 * Dónde van la etiqueta y la insignia de un sector (CANON §4.3): su centro de masa o, si ese punto
 * cae fuera del polígono (un sector cóncavo), un punto que seguro está dentro. Devuelve
 * `[lat, lng]`, el orden de Leaflet (GeoJSON usa `[lng, lat]`).
 */
export function puntoEtiqueta(sector: SectorFeatureDto): [number, number] {
  // El DTO es un Feature de MultiPolygon de GeoJSON; se pasa con el tipo que espera Turf.
  const poligono = sector as unknown as Parameters<typeof booleanPointInPolygon>[1];
  const centro = centerOfMass(poligono);
  const punto = booleanPointInPolygon(centro, poligono) ? centro : pointOnFeature(poligono);
  const [lng, lat] = punto.geometry.coordinates;
  return [lat ?? 0, lng ?? 0];
}
