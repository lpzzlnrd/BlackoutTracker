import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { abrirCortesDemo, CORTES_DEMO } from '../src/db/demo';
import { importarCampo } from '../src/db/importar-campo';
import { ReportesService } from '../src/reportes/reportes.service';
import { Contexto } from './contexto';
import { URL_BD_TEST } from './entorno';

const DEMO = readFileSync(join(__dirname, '../../../data/demo.csv'), 'utf-8');
const IDS_DEMO = CORTES_DEMO.flatMap((c) => c.reportes.map((r) => r.residenteId));

describe('seed de demo (T-061, D-027)', () => {
  let ctx: Contexto;

  beforeAll(async () => {
    ctx = await Contexto.crear();
  });
  afterAll(() => ctx.cerrar());
  // La demo va sobre el Guaparo real: sus nombres son los de data/sectores-guaparo.geojson.
  beforeEach(() => ctx.reiniciar('sectores-guaparo.geojson'));

  const sembrar = async () => ({
    historial: await importarCampo(ctx.bd.sql, DEMO, ctx.ahora),
    creados: await abrirCortesDemo(ctx.bd.sql, ctx.app.get(ReportesService), ctx.ahora),
  });
  const idSector = async (nombre: string) => {
    const [{ id }] = await ctx.bd.sql<
      { id: number }[]
    >`select id from sectores where nombre = ${nombre}`;
    return id;
  };
  const conteos = async () => {
    const [fila] = await ctx.bd.sql`
      select (select count(*)::int from eventos_sector) as eventos,
             (select count(*)::int from reportes) as reportes,
             (select count(*)::int from residentes where id = any(${IDS_DEMO})) as residentes`;
    return fila;
  };

  it('EST-01, EST-04: hay cifra con n ≥ n_min y "datos insuficientes" por debajo', async () => {
    await sembrar();
    const { token } = await ctx.residente(1);
    const esperado: Array<[string, string, number, boolean]> = [
      ['Guaparo Noroeste', 'agua', 7, true],
      ['Guaparo Noroeste', 'electricidad', 11, true],
      ['Guaparo Calle 160', 'agua', 5, true],
      ['Guaparo Calle 160', 'electricidad', 3, false],
      ['Guaparo Suroeste', 'agua', 2, false],
      ['Guaparo Suroeste', 'electricidad', 8, true],
      ['Guaparo Sur', 'agua', 9, true],
      ['Guaparo Sur', 'electricidad', 6, true],
    ];
    for (const [sector, tipo, n, suficiente] of esperado) {
      const res = await ctx
        .get(`/api/estimaciones?sectorId=${await idSector(sector)}&tipoServicio=${tipo}`, token)
        .expect(200);
      expect({ sector, tipo, n: res.body.n, suficiente: res.body.suficiente }).toEqual({
        sector,
        tipo,
        n,
        suficiente,
      });
      if (suficiente) expect(res.body.medianaMin).toBeGreaterThan(0);
      else expect(res.body.medianaMin).toBeUndefined();
    }
  });

  it('EST-03: el corte de luz de 30 h de Noroeste no arrastra la mediana', async () => {
    await sembrar();
    const { token } = await ctx.residente(1);
    const res = await ctx
      .get(
        `/api/estimaciones?sectorId=${await idSector('Guaparo Noroeste')}&tipoServicio=electricidad`,
        token,
      )
      .expect(200);
    // Las demás duraciones de luz de Noroeste están entre 1 y 5 h.
    expect(res.body.medianaMin).toBeLessThanOrEqual(5 * 60);
  });

  it('CON-02, CON-01: un corte de luz confirmado en Suroeste y 2 reportes de agua sin confirmar en Calle 160', async () => {
    const { creados } = await sembrar();
    expect(creados).toBe(5);
    const [luz] = await ctx.bd.sql`
      select estado, reportes_sin_confirmar, evento_id from estado_sector
      where sector_id = ${await idSector('Guaparo Suroeste')} and tipo_servicio = 'electricidad'`;
    expect(luz).toMatchObject({ estado: 'sin_servicio', reportes_sin_confirmar: 0 });
    expect(luz.evento_id).not.toBeNull();
    const [agua] = await ctx.bd.sql`
      select estado, reportes_sin_confirmar from estado_sector
      where sector_id = ${await idSector('Guaparo Calle 160')} and tipo_servicio = 'agua'`;
    expect(agua).toEqual({ estado: 'con_servicio', reportes_sin_confirmar: 2 });
  });

  it('VIS-04: el panel de Suroeste muestra el corte de luz en curso y la estimación con su n', async () => {
    await sembrar();
    const { token } = await ctx.residente(1);
    const res = await ctx
      .get(`/api/sectores/${await idSector('Guaparo Suroeste')}/resumen`, token)
      .expect(200);
    const luz = res.body.servicios.find(
      (s: { tipoServicio: string }) => s.tipoServicio === 'electricidad',
    );
    expect(luz.estado).toBe('sin_servicio');
    expect(luz.estimacion).toMatchObject({ suficiente: true, n: 8 });
    expect(luz.ultimosEventos[0]).toMatchObject({ finEn: null });
    expect(luz.ultimosEventos).toHaveLength(5);
  });

  it('T-061: es idempotente (sembrar dos veces no duplica eventos, reportes ni residentes)', async () => {
    const primera = await sembrar();
    expect(primera.historial).toEqual({ insertadas: 51, yaCargadas: 0, invalidas: [] });
    const antes = await conteos();
    expect(antes).toEqual({ eventos: 52, reportes: 5, residentes: 5 });

    const segunda = await sembrar();
    expect(segunda).toEqual({
      historial: { insertadas: 0, yaCargadas: 51, invalidas: [] },
      creados: 0,
    });
    expect(await conteos()).toEqual(antes);
  });

  describe('script db:seed:demo', () => {
    const correr = (argumentos: string[], env: Record<string, string> = {}) =>
      promisify(execFile)(
        process.execPath,
        ['-r', 'ts-node/register/transpile-only', 'scripts/seed-demo.ts', ...argumentos],
        {
          cwd: join(__dirname, '..'),
          env: { ...process.env, DATABASE_URL: URL_BD_TEST, ...env },
        },
      );

    it('siembra todo, con los reportes en vivo, y la segunda corrida no agrega nada', async () => {
      const primera = await correr([]);
      expect(primera.stdout).toMatch(/Historial de demo: 51 nuevos, 0 ya estaban\./);
      expect(primera.stdout).toMatch(/Reportes en vivo: 5 nuevos/);
      const segunda = await correr([]);
      expect(segunda.stdout).toMatch(/Historial de demo: 0 nuevos, 51 ya estaban\./);
      expect(segunda.stdout).toMatch(/Reportes en vivo: 0 nuevos/);
    }, 60_000);

    it('con --sin-corte solo deja el historial', async () => {
      const { stdout } = await correr(['--sin-corte']);
      expect(stdout).not.toMatch(/Reportes en vivo/);
      expect(await conteos()).toMatchObject({ eventos: 51, reportes: 0 });
    }, 30_000);

    it('se niega en producción salvo con --forzar, sin tocar la base', async () => {
      await expect(
        correr([], {
          DATABASE_URL: 'postgres://u:p@db.ejemplo.supabase.co:5432/postgres',
          NODE_ENV: 'production',
        }),
      ).rejects.toMatchObject({
        code: 1,
        stderr: expect.stringContaining('No se siembra la demo: NODE_ENV=production') as string,
      });
    }, 30_000);
  });
});
