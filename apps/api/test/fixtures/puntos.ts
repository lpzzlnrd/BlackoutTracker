// Coordenadas de control para los sectores provisionales de data/sectores-guaparo.geojson (D-005):
// una cuadrícula de 2 × 2. La numeración (ids) es la del orden del archivo y de la siembra:
//   1 Noroeste · 2 Noreste · 3 Suroeste · 4 Sureste
// Si cambia el GeoJSON provisional, hay que actualizar estas coordenadas.
// Ojo con el orden: `lat` primero en estos objetos, y `[lng, lat]` en GeoJSON y en ST_MakePoint.

export interface Punto {
  lat: number;
  lng: number;
}

/** Dentro de cada sector, lejos de cualquier borde. */
export const DENTRO = {
  noroeste: { lat: 10.2075, lng: -68.009 },
  noreste: { lat: 10.2075, lng: -68.003 },
  suroeste: { lat: 10.2025, lng: -68.009 },
  sureste: { lat: 10.2025, lng: -68.003 },
} as const satisfies Record<string, Punto>;

/** Ids esperados de cada sector tras sembrar el archivo provisional. */
export const ID_SECTOR = { noroeste: 1, noreste: 2, suroeste: 3, sureste: 4 } as const;

/** Fuera de Guaparo (REG-02): cerca, y en otra ciudad. */
export const FUERA = {
  cerca: { lat: 10.25, lng: -68.0 },
  caracas: { lat: 10.48, lng: -66.9 },
} as const satisfies Record<string, Punto>;

/** Sobre el borde exterior de Guaparo: se acepta (D-002). */
export const BORDE_EXTERIOR = {
  norte: { lat: 10.21, lng: -68.009 }, // borde norte del Noroeste
  oeste: { lat: 10.2025, lng: -68.012 }, // borde oeste del Suroeste
} as const satisfies Record<string, Punto>;

/** Sobre el borde entre sectores: gana el de menor id (D-002). */
export const BORDE_ENTRE_SECTORES = {
  /** Entre Noroeste (1) y Noreste (2) → 1. */
  noroesteNoreste: { punto: { lat: 10.2075, lng: -68.006 }, sectorId: 1 },
  /** Entre Suroeste (3) y Sureste (4) → 3. */
  suroesteSureste: { punto: { lat: 10.2025, lng: -68.006 }, sectorId: 3 },
  /** Entre Noreste (2) y Sureste (4) → 2. */
  norestSureste: { punto: { lat: 10.205, lng: -68.003 }, sectorId: 2 },
  /** La esquina que comparten los cuatro → 1. */
  esquinaCentral: { punto: { lat: 10.205, lng: -68.006 }, sectorId: 1 },
} as const;

/**
 * El punto asimétrico de REG-01: el pin del Noreste con `lat` y `lng` intercambiados. Si la API
 * confunde el orden, este punto (lat -68.003, lng 10.2075) cae fuera de Guaparo y lo delata.
 */
export const INTERCAMBIADO = { lat: DENTRO.noreste.lng, lng: DENTRO.noreste.lat } as const;
