import type { GeometriaMultiPoligonoDto } from '@blackout/shared';
import { cellToBoundary, cellToLatLng, latLngToCell } from 'h3-js';

/**
 * Resolución H3 de los sectores (D-040): hexágonos de unos 0,74 km² de media (0,65 km² en
 * Valencia), con unos 920 m de una punta a la otra. Es lo bastante grande para que una celda junte
 * 3 vecinos (N = 3) con pocos usuarios. No es configurable a propósito: si cambia, cada pin cae en
 * otra celda y los sectores, sus residentes y su historial quedan en la cuadrícula vieja.
 */
export const RESOLUCION_H3 = 8;

/** La celda que contiene el punto, en hexadecimal (`8867432a23fffff`). */
export const celdaDe = (lat: number, lng: number): string => latLngToCell(lat, lng, RESOLUCION_H3);

/** El centro de la celda. */
export function centroDe(celda: string): { lat: number; lng: number } {
  const [lat, lng] = cellToLatLng(celda);
  return { lat, lng };
}

const redondear = (n: number) => Math.round(n * 1e7) / 1e7;

/** El hexágono de la celda como MultiPolygon GeoJSON: `[lng, lat]` y el anillo cerrado. */
export function hexagonoDe(celda: string): GeometriaMultiPoligonoDto {
  const anillo = cellToBoundary(celda, true).map(([lng, lat]) => [
    redondear(lng ?? 0),
    redondear(lat ?? 0),
  ]);
  return { type: 'MultiPolygon', coordinates: [[anillo]] };
}

/**
 * El primer nombre libre para un sector nuevo: `base` si nadie lo usa, y si no `base 2`, `base 3`…
 * (`sectores.nombre` es único). Dos celdas vecinas suelen tener el mismo lugar más cercano.
 */
export function nombreLibre(base: string, ocupados: Iterable<string>): string {
  const tomados = new Set(ocupados);
  if (!tomados.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const candidato = `${base} ${n}`;
    if (!tomados.has(candidato)) return candidato;
  }
}
