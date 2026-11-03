import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { leerLugares, leerZona, sembrarZona } from '../src/db/sembrar-zona';
import { abrirBd, type BdTest, cuadrado } from './bd';
import { BORDE_ZONA, DENTRO, FUERA } from './fixtures/puntos';

// La zona real ya la sembró `global-setup.ts`. Estos tests la vuelven a sembrar (es idempotente) y
// prueban los rechazos, que no guardan nada; nunca dejan municipios de mentira en la base, porque
// los demás tests (y `GET /zona`) usan la tabla.

const DATOS = join(__dirname, '../../../data');
const leer = (archivo: string): unknown => JSON.parse(readFileSync(join(DATOS, archivo), 'utf-8'));
const zona = () => leerZona(leer('zona-gran-valencia.geojson'));
const lugares = () => leerLugares(leer('lugares-gran-valencia.geojson'));

const MUNICIPIOS = ['Valencia', 'Naguanagua', 'San Diego', 'Los Guayos', 'Libertador'];

describe('siembra de la zona de cobertura (T-070, D-040)', () => {
  let bd: BdTest;

  beforeAll(() => {
    bd = abrirBd();
  });
  afterAll(() => bd.sql.end());

  const municipioDe = async ({ lat, lng }: { lat: number; lng: number }) => {
    const filas = await bd.sql<{ nombre: string }[]>`
      select nombre from municipios
      where st_covers(geom, st_setsrid(st_makepoint(${lng}, ${lat}), 4326)) order by id`;
    return filas.map((f) => f.nombre);
  };
  const cuantos = async () => {
    const [fila] = await bd.sql<{ municipios: number; lugares: number }[]>`
      select (select count(*)::int from municipios) as municipios,
             (select count(*)::int from lugares) as lugares`;
    return fila;
  };

  it('siembra los 5 municipios de la Gran Valencia: válidos, sin solapes, una pieza sin huecos', async () => {
    const res = await sembrarZona(bd.sql, zona(), lugares());
    expect(res).toEqual({ municipios: 5, lugares: lugares().length });
    const filas = await bd.sql<{ nombre: string; valida: boolean; srid: number }[]>`
      select nombre, st_isvalid(geom) as valida, st_srid(geom) as srid from municipios order by id`;
    expect(filas.map((f) => f.nombre)).toEqual(MUNICIPIOS);
    expect(filas.every((f) => f.valida && f.srid === 4326)).toBe(true);
    // Los límites de OSM comparten los vértices: la unión no deja rendijas entre municipios.
    const [geo] = await bd.sql`
      select st_numgeometries(st_union(geom)) as piezas,
             st_numinteriorrings(st_geometryn(st_union(geom), 1)) as huecos
      from municipios`;
    expect(geo).toEqual({ piezas: 1, huecos: 0 });
  });

  it('es idempotente: volver a sembrar no duplica municipios ni lugares ni cambia los ids', async () => {
    const antes = await bd.sql`select id, nombre from municipios order by id`;
    await sembrarZona(bd.sql, zona(), lugares());
    await sembrarZona(bd.sql, zona(), lugares());
    expect(await bd.sql`select id, nombre from municipios order by id`).toEqual(antes);
    expect(await cuantos()).toEqual({ municipios: 5, lugares: lugares().length });
  });

  it('REG-01, REG-02, REG-03: los puntos de control caen donde deben (lng, lat en ese orden)', async () => {
    for (const punto of Object.values(DENTRO))
      expect(await municipioDe(punto)).toEqual(['Valencia']);
    for (const punto of Object.values(FUERA)) expect(await municipioDe(punto)).toEqual([]);
    expect(await municipioDe(BORDE_ZONA)).toEqual(['Valencia']);
    expect(await municipioDe({ lat: 10.10624, lng: -68.09422 })).toEqual(['Libertador']); // Tocuyito
  });

  it('rechaza, sin guardar nada, un municipio con la geometría inválida', async () => {
    const corbata = {
      nombre: 'Corbata',
      geometria: {
        type: 'MultiPolygon' as const,
        coordinates: [
          [
            [
              [0, 0],
              [1, 1],
              [1, 0],
              [0, 1],
              [0, 0],
            ],
          ],
        ],
      },
    };
    await expect(sembrarZona(bd.sql, [...zona(), corbata], lugares())).rejects.toThrow(/inválida/);
    expect(await cuantos()).toEqual({ municipios: 5, lugares: lugares().length });
  });

  it('rechaza, sin guardar nada, un municipio que se solapa con otro', async () => {
    // Un cuadrado de ~1 km sobre Guaparo, dentro del municipio Valencia.
    const solapado = { nombre: 'Solapado', geometria: cuadrado(-68.02, 10.215) as never };
    await expect(sembrarZona(bd.sql, [...zona(), solapado], [])).rejects.toThrow(/solapados/);
    expect(await cuantos()).toEqual({ municipios: 5, lugares: lugares().length });
  });
});
