import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { leerSectores, sembrarSectores } from '../src/db/sembrar-sectores';
import { abrirBd, type BdTest, cuadrado, limpiar } from './bd';
import { BORDE_ENTRE_SECTORES, DENTRO, ID_SECTOR } from './fixtures/puntos';

const GEOJSON = join(__dirname, '../../../data/sectores-cuadricula.geojson');

describe('siembra de sectores (T-012)', () => {
  let bd: BdTest;
  const sectoresDelArchivo = () => leerSectores(JSON.parse(readFileSync(GEOJSON, 'utf-8')));

  beforeAll(() => {
    bd = abrirBd();
  });
  afterAll(() => bd.sql.end());
  beforeEach(() => limpiar(bd.sql));

  it('siembra los 4 sectores de la cuadrícula y 8 filas de estado_sector (sector × servicio)', async () => {
    const res = await sembrarSectores(bd.sql, sectoresDelArchivo());
    expect(res).toEqual({ sectores: 4, filasEstado: 8 });
    const filas =
      await bd.sql`select nombre, st_isvalid(geom) as valida, st_srid(geom) as srid from sectores order by id`;
    expect(filas.map((f) => f.nombre)).toEqual([
      'Guaparo Noroeste',
      'Guaparo Noreste',
      'Guaparo Suroeste',
      'Guaparo Sureste',
    ]);
    expect(filas.every((f) => f.valida === true && f.srid === 4326)).toBe(true);
  });

  it('el GeoJSON real de Guaparo siembra 6 sectores válidos, sin solapes ni huecos (D-036)', async () => {
    const real = leerSectores(
      JSON.parse(readFileSync(join(__dirname, '../../../data/sectores-guaparo.geojson'), 'utf-8')),
    );
    // sembrarSectores ya rechaza los solapes; aquí además la unión no deja huecos dentro.
    expect(await sembrarSectores(bd.sql, real)).toEqual({ sectores: 6, filasEstado: 12 });
    const [geo] = await bd.sql`
      select bool_and(st_isvalid(geom)) as validos,
             st_numinteriorrings(st_geometryn(st_union(geom), 1)) as huecos,
             st_numgeometries(st_union(geom)) as piezas
      from sectores`;
    expect(geo).toEqual({ validos: true, huecos: 0, piezas: 1 });
  });

  it('es idempotente: correrla dos veces no duplica nada', async () => {
    await sembrarSectores(bd.sql, sectoresDelArchivo());
    const res = await sembrarSectores(bd.sql, sectoresDelArchivo());
    expect(res).toEqual({ sectores: 4, filasEstado: 8 });
    const [{ n }] = await bd.sql`select count(*)::int as n from sectores`;
    expect(n).toBe(4);
  });

  it('los puntos de control caen en el sector esperado (lng, lat en ese orden)', async () => {
    await sembrarSectores(bd.sql, sectoresDelArchivo());
    const sectorDe = async (lat: number, lng: number) => {
      const [fila] = await bd.sql`
        select id from sectores where st_covers(geom, st_setsrid(st_makepoint(${lng}, ${lat}), 4326))
        order by id limit 1`;
      return fila?.id as number | undefined;
    };
    expect(await sectorDe(DENTRO.noroeste.lat, DENTRO.noroeste.lng)).toBe(ID_SECTOR.noroeste);
    expect(await sectorDe(DENTRO.sureste.lat, DENTRO.sureste.lng)).toBe(ID_SECTOR.sureste);
    for (const { punto, sectorId } of Object.values(BORDE_ENTRE_SECTORES)) {
      expect(await sectorDe(punto.lat, punto.lng)).toBe(sectorId);
    }
  });

  it('rechaza (sin guardar nada) una geometría inválida', async () => {
    const corbata = {
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
    };
    await expect(
      sembrarSectores(bd.sql, [{ nombre: 'Corbata', geometria: corbata }]),
    ).rejects.toThrow(/inválida/);
    const [{ n }] = await bd.sql`select count(*)::int as n from sectores`;
    expect(n).toBe(0);
  });

  it('rechaza dos sectores que se solapan, pero acepta los que solo comparten borde', async () => {
    const a = { nombre: 'A', geometria: cuadrado(0, 0) as never };
    const vecino = { nombre: 'B', geometria: cuadrado(0.01, 0) as never };
    const solapado = { nombre: 'C', geometria: cuadrado(0.005, 0) as never };
    await expect(sembrarSectores(bd.sql, [a, vecino])).resolves.toMatchObject({ sectores: 2 });
    await expect(sembrarSectores(bd.sql, [a, vecino, solapado])).rejects.toThrow(/solapados/);
    const [{ n }] = await bd.sql`select count(*)::int as n from sectores`;
    expect(n).toBe(2);
  });
});
