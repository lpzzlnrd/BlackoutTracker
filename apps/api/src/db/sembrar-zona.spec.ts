import { leerLugares, leerZona } from './sembrar-zona';

const poligono = [
  [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 0],
  ],
];
const feature = (properties: Record<string, unknown>, geometry: unknown) => ({
  type: 'Feature',
  properties,
  geometry,
});
const coleccion = (...features: unknown[]) => ({ type: 'FeatureCollection', features });
const punto = (lng: number, lat: number) => ({ type: 'Point', coordinates: [lng, lat] });

describe('leerZona', () => {
  it('acepta MultiPolygon y envuelve un Polygon como MultiPolygon', () => {
    const zona = leerZona(
      coleccion(
        feature({ nombre: 'A' }, { type: 'MultiPolygon', coordinates: [poligono] }),
        feature({ nombre: 'B' }, { type: 'Polygon', coordinates: poligono }),
      ),
    );
    expect(zona.map((m) => m.nombre)).toEqual(['A', 'B']);
    expect(zona[1]?.geometria).toEqual({ type: 'MultiPolygon', coordinates: [poligono] });
  });

  it.each([
    ['no es un FeatureCollection', { type: 'Feature' }],
    ['no tiene municipios', coleccion()],
    [
      'un municipio sin nombre',
      coleccion(feature({ nombre: '' }, { type: 'Polygon', coordinates: poligono })),
    ],
    [
      'un nombre repetido',
      coleccion(
        feature({ nombre: 'A' }, { type: 'Polygon', coordinates: poligono }),
        feature({ nombre: 'A' }, { type: 'Polygon', coordinates: poligono }),
      ),
    ],
    ['una geometría que no es polígono', coleccion(feature({ nombre: 'A' }, punto(0, 0)))],
  ])('rechaza el GeoJSON que tiene %s', (_motivo, entrada) => {
    expect(() => leerZona(entrada)).toThrow();
  });
});

describe('leerLugares', () => {
  it('lee nombre, peso y coordenadas; el peso por defecto es 1', () => {
    expect(
      leerLugares(
        coleccion(
          feature({ nombre: 'Guaparo', peso: 1 }, punto(-68.01, 10.22)),
          feature({ nombre: 'Prebo' }, punto(-68.02, 10.21)),
        ),
      ),
    ).toEqual([
      { nombre: 'Guaparo', peso: 1, lng: -68.01, lat: 10.22 },
      { nombre: 'Prebo', peso: 1, lng: -68.02, lat: 10.21 },
    ]);
  });

  it.each([
    ['está vacío', coleccion()],
    ['tiene un lugar sin nombre', coleccion(feature({}, punto(0, 0)))],
    [
      'tiene un lugar que no es un punto',
      coleccion(feature({ nombre: 'A' }, { type: 'Polygon', coordinates: poligono })),
    ],
    ['tiene un peso cero', coleccion(feature({ nombre: 'A', peso: 0 }, punto(0, 0)))],
  ])('rechaza el GeoJSON que %s', (_motivo, entrada) => {
    expect(() => leerLugares(entrada)).toThrow();
  });
});
