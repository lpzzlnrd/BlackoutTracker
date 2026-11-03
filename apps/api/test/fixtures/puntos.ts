// Coordenadas de control (T-070, D-040). Los sectores de prueba son 4 celdas H3 vecinas sobre
// Guaparo, en el municipio Valencia, que `Contexto.reiniciar` crea en este orden y con estos
// nombres fijos (no los de OSM), así que sus ids son:
//   1 Noroeste · 2 Noreste · 3 Suroeste · 4 Sureste
// Cada punto es el centro de su celda, lejos de los bordes. La zona es la real
// (data/zona-gran-valencia.geojson), que `global-setup.ts` siembra una vez.
// Ojo con el orden: `lat` primero en estos objetos, y `[lng, lat]` en GeoJSON y en ST_MakePoint.

export interface Punto {
  lat: number;
  lng: number;
}

/** El centro de cada celda de prueba. */
export const DENTRO = {
  noroeste: { lat: 10.22512, lng: -68.01642 },
  noreste: { lat: 10.22531, lng: -68.00843 },
  suroeste: { lat: 10.21172, lng: -68.0147 },
  sureste: { lat: 10.2119, lng: -68.00671 },
} as const satisfies Record<string, Punto>;

/** Ids de los sectores de prueba tras `reiniciar()`. */
export const ID_SECTOR = { noroeste: 1, noreste: 2, suroeste: 3, sureste: 4 } as const;

/** Nombres fijos de los sectores de prueba. */
export const NOMBRE_SECTOR = {
  noroeste: 'Noroeste',
  noreste: 'Noreste',
  suroeste: 'Suroeste',
  sureste: 'Sureste',
} as const;

/** Índice H3 de cada celda de prueba. */
export const CELDA = {
  noroeste: '8867432a21fffff',
  noreste: '8867432a2bfffff',
  suroeste: '8867432849fffff',
  sureste: '8867432a35fffff',
} as const;

/** Otro punto de la celda del Noroeste, a unos 150 m de su centro: cae en el mismo sector. */
export const MISMA_CELDA_NOROESTE = { lat: 10.224, lng: -68.0175 } as const;

/**
 * El nodo de La Viña en OSM: su celda (8867432a27fffff) no es de prueba, así que el sector no
 * existe y el registro lo crea con el nombre de ese lugar.
 */
export const LA_VINA = { lat: 10.21577, lng: -68.01923 } as const;

/** Fuera de la Gran Valencia (REG-02): Guacara, el municipio vecino al este, y Caracas. */
export const FUERA = {
  cerca: { lat: 10.2266, lng: -67.877 },
  caracas: { lat: 10.48, lng: -66.9 },
} as const satisfies Record<string, Punto>;

/**
 * Sobre el límite exterior de la zona: el vértice más al sur del municipio Valencia. Se acepta
 * (REG-03, D-002: `ST_Covers` incluye el borde).
 */
export const BORDE_ZONA = { lat: 9.811476, lng: -67.917277 } as const;

/**
 * El punto asimétrico de REG-01: el pin del Noreste con `lat` y `lng` intercambiados. Si la API
 * confunde el orden, este punto (lat -68.00843, lng 10.22531) cae fuera de la zona y lo delata.
 */
export const INTERCAMBIADO = { lat: DENTRO.noreste.lng, lng: DENTRO.noreste.lat } as const;
