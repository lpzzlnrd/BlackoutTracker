import { leerSectores } from './sembrar-sectores';

const poligono = [
  [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 0],
  ],
];
const feature = (nombre: unknown, geometry: unknown) => ({
  type: 'Feature',
  properties: { nombre },
  geometry,
});
const coleccion = (...features: unknown[]) => ({ type: 'FeatureCollection', features });

describe('leerSectores', () => {
  it('acepta MultiPolygon y envuelve un Polygon como MultiPolygon', () => {
    const sectores = leerSectores(
      coleccion(
        feature('A', { type: 'MultiPolygon', coordinates: [poligono] }),
        feature('B', { type: 'Polygon', coordinates: poligono }),
      ),
    );
    expect(sectores.map((s) => s.nombre)).toEqual(['A', 'B']);
    expect(sectores[1].geometria).toEqual({ type: 'MultiPolygon', coordinates: [poligono] });
  });

  it.each([
    ['no es un FeatureCollection', { type: 'Feature' }],
    ['no tiene sectores', coleccion()],
    ['un sector sin nombre', coleccion(feature('', { type: 'Polygon', coordinates: poligono }))],
    [
      'nombre repetido',
      coleccion(
        feature('A', { type: 'Polygon', coordinates: poligono }),
        feature('A', { type: 'Polygon', coordinates: poligono }),
      ),
    ],
    [
      'geometría que no es polígono',
      coleccion(feature('A', { type: 'Point', coordinates: [0, 0] })),
    ],
  ])('rechaza el GeoJSON que %s', (_motivo, entrada) => {
    expect(() => leerSectores(entrada)).toThrow();
  });
});
