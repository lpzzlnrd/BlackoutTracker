import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { importarCampo } from '../src/db/importar-campo';
import { leerSectores, sembrarSectores } from '../src/db/sembrar-sectores';
import { abrirBd, type BdTest, limpiar } from './bd';
import { URL_BD_TEST } from './entorno';
import { ID_SECTOR } from './fixtures/puntos';

const RAIZ = join(__dirname, '../../..');
const EJEMPLO = readFileSync(join(RAIZ, 'data/campo.ejemplo.csv'), 'utf-8');
const AHORA = new Date('2026-10-25T12:00:00Z');
const CABECERA = 'sector,tipo_servicio,inicio,fin';
const csv = (...filas: string[]) => [CABECERA, ...filas].join('\n');

describe('importación del dataset de campo (T-044)', () => {
  let bd: BdTest;
  const contarCampo = async () => {
    const [{ n }] =
      await bd.sql`select count(*)::int as n from eventos_sector where origen = 'campo'`;
    return n as number;
  };

  beforeAll(() => {
    bd = abrirBd();
  });
  afterAll(() => bd.sql.end());
  beforeEach(async () => {
    await limpiar(bd.sql);
    const geojson: unknown = JSON.parse(
      readFileSync(join(RAIZ, 'data/sectores-guaparo.geojson'), 'utf-8'),
    );
    await sembrarSectores(bd.sql, leerSectores(geojson));
  });

  it('carga el CSV de ejemplo como eventos cerrados de origen campo', async () => {
    const res = await importarCampo(bd.sql, EJEMPLO, AHORA);
    expect(res).toEqual({ insertadas: 27, yaCargadas: 0, invalidas: [] });
    // La conexión de la API devuelve las fechas como texto: se comparan en SQL.
    const [evento] = await bd.sql`
      select inicio_en = '2026-09-02T14:10:00-04:00' as inicio_ok,
             fin_en = '2026-09-02T17:40:00-04:00' as fin_ok,
             confirmado_en = inicio_en as confirmado_ok,
             restablecido_en = fin_en as restablecido_ok,
             origen
      from eventos_sector
      where sector_id = ${ID_SECTOR.noroeste} and tipo_servicio = 'electricidad'
      order by inicio_en limit 1`;
    expect(evento).toEqual({
      inicio_ok: true,
      fin_ok: true,
      confirmado_ok: true,
      restablecido_ok: true,
      origen: 'campo',
    });
  });

  it('es idempotente: volver a cargar el mismo CSV no duplica nada', async () => {
    await importarCampo(bd.sql, EJEMPLO, AHORA);
    const res = await importarCampo(bd.sql, EJEMPLO, AHORA);
    expect(res).toEqual({ insertadas: 0, yaCargadas: 27, invalidas: [] });
    expect(await contarCampo()).toBe(27);
  });

  it('un CSV ampliado solo agrega las filas nuevas', async () => {
    const fila = 'Guaparo Sureste,agua,2026-09-05T05:00Z,2026-09-05T21:00Z';
    await importarCampo(bd.sql, csv(fila), AHORA);
    const res = await importarCampo(
      bd.sql,
      csv(fila, 'Guaparo Sureste,agua,2026-09-07T05:00Z,2026-09-07T21:00Z'),
      AHORA,
    );
    expect(res).toEqual({ insertadas: 1, yaCargadas: 1, invalidas: [] });
  });

  it('informa las filas inválidas con su línea y guarda las válidas', async () => {
    const res = await importarCampo(
      bd.sql,
      csv(
        'Guaparo Sureste,agua,2026-09-05T05:00Z,2026-09-05T21:00Z',
        'Trigal,agua,2026-09-05T05:00Z,2026-09-05T21:00Z',
        'Guaparo Sureste,agua,2026-09-07T21:00Z,2026-09-07T05:00Z',
      ),
      AHORA,
    );
    expect(res.insertadas).toBe(1);
    expect(res.invalidas.map((i) => i.linea)).toEqual([3, 4]);
    expect(await contarCampo()).toBe(1);
  });

  it('rechaza un ciclo que se solapa con un evento ya guardado (también uno abierto de consenso)', async () => {
    await bd.sql`
      insert into eventos_sector (sector_id, tipo_servicio, inicio_en, confirmado_en)
      values (${ID_SECTOR.sureste}, 'agua', '2026-10-24T08:00Z', '2026-10-24T08:30Z')`;
    const res = await importarCampo(
      bd.sql,
      csv(
        'Guaparo Sureste,agua,2026-10-24T10:00Z,2026-10-24T12:00Z',
        'Guaparo Sureste,agua,2026-10-23T10:00Z,2026-10-23T12:00Z',
        'Guaparo Sureste,electricidad,2026-10-24T10:00Z,2026-10-24T12:00Z',
      ),
      AHORA,
    );
    expect(res.insertadas).toBe(2);
    expect(res.invalidas).toEqual([
      {
        linea: 2,
        motivo: expect.stringMatching(/Se solapa con el evento \d+ \(consenso\)/) as string,
      },
    ]);
  });

  it('sin sectores sembrados, falla con un mensaje claro y no guarda nada', async () => {
    await limpiar(bd.sql);
    await expect(importarCampo(bd.sql, EJEMPLO, AHORA)).rejects.toThrow(/db:seed/);
    expect(await contarCampo()).toBe(0);
  });

  it('los eventos de campo entran a la mediana por sector y servicio (D-008)', async () => {
    await importarCampo(bd.sql, EJEMPLO, AHORA);
    const [fila] = await bd.sql`
      select count(*)::int as n,
             percentile_cont(0.5) within group (order by extract(epoch from fin_en - inicio_en) / 60)
               as mediana_min
      from eventos_sector
      where sector_id = ${ID_SECTOR.sureste} and tipo_servicio = 'electricidad' and fin_en is not null`;
    // Duraciones: 120, 150, 105, 160 y 130 min → mediana 130.
    expect(fila).toEqual({ n: 5, mediana_min: 130 });
  });

  describe('script db:seed:campo', () => {
    const correr = (ruta: string) =>
      promisify(execFile)(
        process.execPath,
        ['-r', 'ts-node/register/transpile-only', 'scripts/seed-campo.ts', ruta],
        {
          cwd: join(__dirname, '..'),
          env: { ...process.env, DATABASE_URL: URL_BD_TEST, INIT_CWD: RAIZ },
        },
      );

    it('carga el archivo (ruta relativa a donde se lanzó pnpm) y resume el resultado', async () => {
      const { stdout } = await correr('data/campo.ejemplo.csv');
      expect(stdout).toMatch(/insertados: 27\. Ya cargados: 0\. Filas inválidas: 0\./);
    }, 30_000);

    it('sale con código 1 y muestra cada fila inválida, pero guarda las válidas', async () => {
      const dir = mkdtempSync(join(tmpdir(), 'campo-'));
      const ruta = join(dir, 'campo.csv');
      writeFileSync(
        ruta,
        csv('Guaparo Sureste,agua,2026-09-05T05:00Z,2026-09-05T21:00Z', 'Trigal,agua,x,y'),
      );
      await expect(correr(ruta)).rejects.toMatchObject({
        code: 1,
        stderr: expect.stringContaining('Línea 3: El sector "Trigal" no existe') as string,
      });
      expect(await contarCampo()).toBe(1);
    }, 30_000);
  });
});
