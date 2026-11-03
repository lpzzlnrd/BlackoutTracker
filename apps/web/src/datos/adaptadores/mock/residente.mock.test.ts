import { describe, expect, it } from 'vitest';
import { cargarPuertosDemo } from './cargar';
import { crearRepositorioResidenteMock } from './residente.mock';
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
    // El centro de la caja del primer sector: cae dentro de su hexágono.
    const anillo = geo.features[0]!.geometry.coordinates[0]![0]!;
    const lngs = anillo.map((c) => c[0]!);
    const lats = anillo.map((c) => c[1]!);
    const pin = {
      lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
      lat: (Math.min(...lats) + Math.max(...lats)) / 2,
    };
    const sector = await p.residente.validarPin(pin);
    expect(sector).toMatchObject({ sectorId: 1, sectorNombre: 'Sector 1', municipio: 'Valencia' });
    // El hexágono del sector, no el pin (NF-06).
    expect(sector.geometria).toEqual(geo.features[0]!.geometry);
    expect(sector).not.toHaveProperty('lat');
  });

  it('D-040: un pin de la zona fuera de los sectores de la demo sería un sector nuevo', async () => {
    const p = await cargarPuertosDemo({ escenario: 'en-linea' });
    // El centro de Tocuyito: dentro de la Gran Valencia, lejos de los hexágonos de Guaparo.
    const sector = await p.residente.validarPin({ lat: 10.106, lng: -68.094 });
    expect(sector).toMatchObject({ sectorId: null, municipio: 'Valencia' });
    expect(sector.geometria.coordinates[0]![0]).toHaveLength(7);
  });

  it('REG-02: un pin fuera de la zona es 422 PIN_FUERA_DE_ZONA', async () => {
    const p = await cargarPuertosDemo({ escenario: 'en-linea' });
    await expect(p.residente.validarPin({ lat: 0, lng: 0 })).rejects.toMatchObject({
      estado: 422,
      codigo: 'PIN_FUERA_DE_ZONA',
    });
  });

  it('D-040: el primer vecino de una celda nueva crea su sector, que aparece en GET /sectores', async () => {
    const p = await cargarPuertosDemo({ escenario: 'en-linea' });
    const geo = await p.sectores.obtenerGeoJson();
    const zona = await p.sectores.obtenerZona();
    const residente = crearRepositorioResidenteMock(geo, zona, null, {
      reloj: p.reloj,
      conexion: p.conexion,
      latenciaMs: 0,
    });
    const creado = await residente.crear({ lat: 10.106, lng: -68.094 });
    expect(creado.sectorId).toBe(5);
    expect(geo.features.map((f) => f.properties.id)).toEqual([1, 2, 3, 4, 5]);
    // Otro pin de la misma celda cae en el sector recién creado.
    expect((await residente.validarPin({ lat: 10.1062, lng: -68.0938 })).sectorId).toBe(5);
  });

  it('crear con perfil existente es 409; GET /residentes/me devuelve el sector de la demo', async () => {
    const p = await cargarPuertosDemo({ escenario: 'en-linea' });
    expect(await p.residente.obtenerMio()).toEqual({
      sectorId: 1,
      sectorNombre: 'Sector 1',
      municipio: 'Valencia',
    });
    await expect(p.residente.crear({ lat: 10.225, lng: -68.016 })).rejects.toMatchObject({
      estado: 409,
      codigo: 'RESIDENTE_YA_REGISTRADO',
    });
  });
});
