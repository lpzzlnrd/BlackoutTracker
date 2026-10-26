import { randomUUID } from 'node:crypto';
import { cuartiles, mediana } from '../src/estimacion/estadistica.puro';
import { Contexto } from './contexto';

describe('Estimación estadística — GET /estimaciones (T-042)', () => {
  let ctx: Contexto;
  let token: string;

  beforeAll(async () => {
    ctx = await Contexto.crear();
  });
  afterAll(() => ctx.cerrar());
  beforeEach(async () => {
    await ctx.reiniciar();
    token = (await ctx.residente(1)).token;
  });

  /** Inserta eventos ya cerrados con las duraciones dadas (minutos), todos con origen 'campo'. */
  const cerrados = async (sectorId: number, tipo: string, duraciones: number[]) => {
    for (const [i, d] of duraciones.entries()) {
      const inicio = new Date(Date.UTC(2026, 0, 1 + i)); // fechas distintas; el único abierto no aplica
      const fin = new Date(inicio.getTime() + d * 60_000);
      await ctx.bd.sql`
        insert into eventos_sector (sector_id, tipo_servicio, inicio_en, fin_en, confirmado_en, restablecido_en, origen)
        values (${sectorId}, ${tipo}, ${inicio.toISOString()}, ${fin.toISOString()},
                ${inicio.toISOString()}, ${fin.toISOString()}, 'campo')`;
    }
  };
  const estimar = (sectorId: number, tipo: string, conToken = true) =>
    ctx.get(
      `/api/estimaciones?sectorId=${sectorId}&tipoServicio=${tipo}`,
      conToken ? token : undefined,
    );

  it('EST-04: con n = 4 (< n_min) no hay cifra, solo el n', async () => {
    await cerrados(1, 'agua', [60, 120, 180, 240]);
    const { body } = await estimar(1, 'agua').expect(200);
    expect(body).toEqual({ suficiente: false, n: 4 });
  });

  it('EST-04: sin ciclos cerrados → insuficiente con n = 0', async () => {
    const { body } = await estimar(1, 'agua').expect(200);
    expect(body).toEqual({ suficiente: false, n: 0 });
  });

  it('EST-01: con n = n_min devuelve la mediana, el n y los cuartiles', async () => {
    await cerrados(1, 'agua', [60, 120, 180, 240, 300]);
    const { body } = await estimar(1, 'agua').expect(200);
    expect(body).toEqual({ suficiente: true, n: 5, medianaMin: 180, q1Min: 120, q3Min: 240 });
  });

  it('EST-05: agua y luz nunca se mezclan, ni los sectores entre sí', async () => {
    await cerrados(1, 'agua', [60, 60, 60, 60, 60]);
    await cerrados(1, 'electricidad', [600, 600, 600, 600, 600, 600]);
    await cerrados(2, 'agua', [1000]);

    expect((await estimar(1, 'agua').expect(200)).body).toMatchObject({ n: 5, medianaMin: 60 });
    expect((await estimar(1, 'electricidad').expect(200)).body).toMatchObject({
      n: 6,
      medianaMin: 600,
    });
    expect((await estimar(2, 'agua').expect(200)).body).toEqual({ suficiente: false, n: 1 });
  });

  it('los ciclos abiertos se excluyen del cálculo', async () => {
    await cerrados(1, 'agua', [60, 120, 180, 240]);
    await ctx.bd.sql`
      insert into eventos_sector (sector_id, tipo_servicio, inicio_en, confirmado_en)
      values (1, 'agua', now() - interval '5 hours', now() - interval '5 hours')`;
    expect((await estimar(1, 'agua').expect(200)).body).toEqual({ suficiente: false, n: 4 });
  });

  it('EST-06: al cerrarse un evento por consenso, la mediana cambia', async () => {
    await cerrados(1, 'electricidad', [60, 60, 200, 200]);
    expect((await estimar(1, 'electricidad').expect(200)).body).toEqual({
      suficiente: false,
      n: 4,
    });

    // Un corte real: 3 vecinos lo confirman y 3 confirman el restablecimiento (95 min).
    const vecinos = await Promise.all([1, 2, 3].map(() => ctx.residente(1)));
    const ids = vecinos.map(() => randomUUID());
    for (const [i, v] of vecinos.entries()) {
      await ctx
        .put(ids[i], v.token, { tipoServicio: 'electricidad', ocurridoEn: ctx.hace(-300 + i * 10) })
        .expect(200);
    }
    for (const [i, v] of vecinos.entries()) {
      await ctx.patch(ids[i], v.token, { ocurridoEn: ctx.hace(-200 + i * 5) }).expect(200);
    }

    const { body } = await estimar(1, 'electricidad').expect(200);
    expect(body).toMatchObject({ suficiente: true, n: 5, medianaMin: 95 });

    // Un sexto ciclo largo vuelve a moverla: el par promedia los dos centrales (95 y 200).
    await cerrados(1, 'electricidad', [400]);
    expect((await estimar(1, 'electricidad').expect(200)).body).toMatchObject({
      n: 6,
      medianaMin: 147.5,
    });
  });

  describe('SQL ≡ TS (percentile_cont contra mediana/cuartiles de T-041)', () => {
    const casos: [string, number[]][] = [
      ['cantidad impar (EST-01)', [45, 10, 200, 90, 30, 75, 120]],
      ['cantidad par (EST-02)', [45, 10, 200, 90, 30, 75]],
      ['con un valor atípico de 30 h (EST-03)', [120, 150, 180, 200, 240, 1800]],
      ['con segundos fraccionarios', [10.5, 20.25, 33.75, 41, 59.5, 61.1, 88]],
    ];
    it.each(casos)('%s', async (_nombre, duraciones) => {
      await cerrados(1, 'agua', duraciones);
      const { body } = await estimar(1, 'agua').expect(200);
      const q = cuartiles(duraciones)!;
      expect(body.suficiente).toBe(true);
      expect(body.n).toBe(duraciones.length);
      expect(body.medianaMin).toBeCloseTo(mediana(duraciones)!, 6);
      expect(body.q1Min).toBeCloseTo(q.q1, 6);
      expect(body.q3Min).toBeCloseTo(q.q3, 6);
    });
  });

  it('EST-03: un corte de 30 h no arruina la mediana', async () => {
    await cerrados(1, 'electricidad', [120, 150, 180, 200, 1800]);
    expect((await estimar(1, 'electricidad').expect(200)).body.medianaMin).toBe(180);
  });

  it('no devuelve coordenadas ni ids de residentes', async () => {
    await cerrados(1, 'agua', [60, 120, 180, 240, 300]);
    const { body } = await estimar(1, 'agua').expect(200);
    expect(Object.keys(body).sort()).toEqual(['medianaMin', 'n', 'q1Min', 'q3Min', 'suficiente']);
  });

  it('sector inexistente → 404 SECTOR_NO_ENCONTRADO', async () => {
    const { body } = await estimar(999, 'agua').expect(404);
    expect(body.codigo).toBe('SECTOR_NO_ENCONTRADO');
  });

  it('parámetros inválidos → 400 y sin token → 401', async () => {
    await estimar(1, 'gas').expect(400);
    await ctx.get('/api/estimaciones?sectorId=abc&tipoServicio=agua', token).expect(400);
    await ctx.get('/api/estimaciones?tipoServicio=agua', token).expect(400);
    await estimar(1, 'agua', false).expect(401);
  });
});
