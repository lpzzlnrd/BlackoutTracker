import { describe, expect, it } from 'vitest';
import { cargarPuertosDemo } from './cargar';
import { puntoEnMultiPoligono } from './punto-en-poligono';

describe('punto-dentro-de-polígono del mock', () => {
  const cuadrado = {
    type: 'MultiPolygon' as const,
    coordinates: [
      [
        [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
          [0, 0],
        ],
        // Un hueco en el centro.
        [
          [4, 4],
          [6, 4],
          [6, 6],
          [4, 6],
          [4, 4],
        ],
      ],
    ],
  };

  it('dentro, fuera y dentro de un hueco', () => {
    expect(puntoEnMultiPoligono(2, 2, cuadrado)).toBe(true);
    expect(puntoEnMultiPoligono(12, 2, cuadrado)).toBe(false);
    expect(puntoEnMultiPoligono(5, 5, cuadrado)).toBe(false);
  });
});

describe('mock del residente: registro con validación geográfica', () => {
  it('REG-01: un pin dentro de un sector devuelve ese sector, sin coordenadas', async () => {
    const p = await cargarPuertosDemo({ escenario: 'en-linea' });
    const geo = await p.sectores.obtenerGeoJson();
    // El centro de la caja del primer sector: la cuadrícula provisional son rectángulos.
    const anillo = geo.features[0]!.geometry.coordinates[0]![0]!;
    const lngs = anillo.map((c) => c[0]!);
    const lats = anillo.map((c) => c[1]!);
    const pin = {
      lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
      lat: (Math.min(...lats) + Math.max(...lats)) / 2,
    };
    const sector = await p.residente.validarPin(pin);
    expect(sector).toEqual({ sectorId: 1, sectorNombre: 'Sector 1' });
    expect(sector).not.toHaveProperty('lat');
  });

  it('REG-02: un pin fuera de Guaparo es 422 PIN_FUERA_DE_GUAPARO', async () => {
    const p = await cargarPuertosDemo({ escenario: 'en-linea' });
    await expect(p.residente.validarPin({ lat: 0, lng: 0 })).rejects.toMatchObject({
      estado: 422,
      codigo: 'PIN_FUERA_DE_GUAPARO',
    });
  });

  it('crear con perfil existente es 409; GET /residentes/me devuelve el sector de la demo', async () => {
    const p = await cargarPuertosDemo({ escenario: 'en-linea' });
    expect(await p.residente.obtenerMio()).toEqual({ sectorId: 1, sectorNombre: 'Sector 1' });
    await expect(p.residente.crear({ lat: 10.2, lng: -68.0 })).rejects.toMatchObject({
      estado: 409,
      codigo: 'RESIDENTE_YA_REGISTRADO',
    });
  });
});
