import type { SectoresGeoJsonDto } from '@blackout/shared';
import { describe, expect, it } from 'vitest';
import { sectorDelPin } from './sector-del-pin';

// Dos cuadrados de 0,01° que comparten el lado lng = -68,00. El de id 2 va primero a propósito:
// el desempate por menor id no depende del orden del GeoJSON.
const cuadrado = (lng0: number, lat0: number) => ({
  type: 'MultiPolygon' as const,
  coordinates: [
    [
      [
        [lng0, lat0],
        [lng0 + 0.01, lat0],
        [lng0 + 0.01, lat0 + 0.01],
        [lng0, lat0 + 0.01],
        [lng0, lat0],
      ],
    ],
  ],
});

const SECTORES: SectoresGeoJsonDto = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 2,
      properties: { id: 2, nombre: 'Este' },
      geometry: cuadrado(-68, 10.2),
    },
    {
      type: 'Feature',
      id: 1,
      properties: { id: 1, nombre: 'Oeste' },
      geometry: cuadrado(-68.01, 10.2),
    },
  ],
};

describe('sectorDelPin', () => {
  it('REG-01: un pin dentro cae en su sector', () => {
    expect(sectorDelPin(SECTORES, { lat: 10.205, lng: -67.995 })).toEqual({
      id: 2,
      nombre: 'Este',
    });
    expect(sectorDelPin(SECTORES, { lat: 10.205, lng: -68.005 })).toEqual({
      id: 1,
      nombre: 'Oeste',
    });
  });

  it('REG-02: un pin fuera de Guaparo no cae en ningún sector', () => {
    expect(sectorDelPin(SECTORES, { lat: 10.3, lng: -67.995 })).toBeNull();
  });

  it('REG-02: lat y lng intercambiados no se aceptan por error', () => {
    expect(sectorDelPin(SECTORES, { lat: -67.995, lng: 10.205 })).toBeNull();
  });

  it('REG-03: el borde exterior se acepta (como ST_Covers, D-002)', () => {
    expect(sectorDelPin(SECTORES, { lat: 10.2, lng: -67.995 })).toEqual({ id: 2, nombre: 'Este' });
  });

  it('REG-03: el borde entre dos sectores va siempre al de menor id', () => {
    const pin = { lat: 10.205, lng: -68 };
    expect(sectorDelPin(SECTORES, pin)).toEqual({ id: 1, nombre: 'Oeste' });
    expect(sectorDelPin({ ...SECTORES, features: [...SECTORES.features].reverse() }, pin)).toEqual({
      id: 1,
      nombre: 'Oeste',
    });
  });
});
