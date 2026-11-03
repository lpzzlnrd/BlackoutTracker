import type { ZonaDto } from '@blackout/shared';
import { describe, expect, it } from 'vitest';
import { dentroDeZona } from './dentro-de-zona';

// Una zona de dos piezas: un cuadrado de 0,1° con un hueco de 0,02° en el medio, y otro aparte.
const anillo = (lng0: number, lat0: number, lado: number) => [
  [lng0, lat0],
  [lng0 + lado, lat0],
  [lng0 + lado, lat0 + lado],
  [lng0, lat0 + lado],
  [lng0, lat0],
];

const ZONA: ZonaDto = {
  type: 'Feature',
  properties: { municipios: ['Valencia', 'Naguanagua'] },
  geometry: {
    type: 'MultiPolygon',
    coordinates: [
      [anillo(-68.1, 10.1, 0.1), anillo(-68.06, 10.14, 0.02)],
      [anillo(-67.9, 10.1, 0.05)],
    ],
  },
};

describe('dentroDeZona', () => {
  it('REG-01: un pin dentro de la Gran Valencia se acepta, en cualquiera de sus piezas', () => {
    expect(dentroDeZona(ZONA, { lat: 10.12, lng: -68.08 })).toBe(true);
    expect(dentroDeZona(ZONA, { lat: 10.12, lng: -67.88 })).toBe(true);
  });

  it('REG-02: un pin fuera de la zona (o en un hueco) no se acepta', () => {
    expect(dentroDeZona(ZONA, { lat: 10.3, lng: -68.08 })).toBe(false);
    expect(dentroDeZona(ZONA, { lat: 10.15, lng: -68.05 })).toBe(false);
  });

  it('REG-02: lat y lng intercambiados no se aceptan por error', () => {
    expect(dentroDeZona(ZONA, { lat: -68.08, lng: 10.12 })).toBe(false);
  });

  it('REG-03: el borde exterior se acepta (como ST_Covers, D-002)', () => {
    expect(dentroDeZona(ZONA, { lat: 10.1, lng: -68.05 })).toBe(true);
  });
});
