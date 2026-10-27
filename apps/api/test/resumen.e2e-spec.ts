import { randomUUID } from 'node:crypto';
import { Contexto, type ResidentePrueba } from './contexto';

interface EventoRes {
  id: number;
  inicioEn: string;
  finEn: string | null;
  duracionMin: number | null;
  sectorId: number;
  tipoServicio: string;
}
interface ServicioRes {
  tipoServicio: string;
  estado: string;
  reportesSinConfirmar: number;
  desde: string | null;
  estimacion: {
    suficiente: boolean;
    n: number;
    medianaMin?: number;
    q1Min?: number;
    q3Min?: number;
  };
  ultimosEventos: EventoRes[];
}

describe('GET /api/sectores/:id/resumen (T-043)', () => {
  let ctx: Contexto;
  let yo: ResidentePrueba;

  beforeAll(async () => {
    ctx = await Contexto.crear();
  });
  afterAll(() => ctx.cerrar());
  beforeEach(async () => {
    await ctx.reiniciar();
    yo = await ctx.residente(1);
  });

  /** `token: null` llama sin cabecera de autorización. */
  const resumen = (sectorId: number | string, token: string | null = yo.token) =>
    ctx.get(`/api/sectores/${sectorId}/resumen`, token ?? undefined);
  const servicio = (cuerpo: { servicios: ServicioRes[] }, tipo: string): ServicioRes => {
    const s = cuerpo.servicios.find((x) => x.tipoServicio === tipo);
    if (!s) throw new Error(`falta el servicio ${tipo}`);
    return s;
  };

  /** Inserta un evento; `finMin` nulo lo deja abierto. Minutos relativos a `ahora`. */
  const evento = async (
    sectorId: number,
    tipo: 'agua' | 'electricidad',
    inicioMin: number,
    finMin: number | null,
  ): Promise<number> => {
    const inicio = new Date(ctx.ahora.getTime() + inicioMin * 60_000).toISOString();
    const fin =
      finMin === null ? null : new Date(ctx.ahora.getTime() + finMin * 60_000).toISOString();
    const [fila] = await ctx.bd.sql<{ id: number }[]>`
      insert into eventos_sector (sector_id, tipo_servicio, inicio_en, fin_en, confirmado_en)
      values (${sectorId}, ${tipo}, ${inicio}::timestamptz, ${fin}::timestamptz, ${inicio}::timestamptz) returning id`;
    return fila.id;
  };

  const vecinos = (n: number): Promise<ResidentePrueba[]> =>
    Promise.all(Array.from({ length: n }, () => ctx.residente(1)));
  const iniciar = async (r: ResidentePrueba, tipo: string, minutos: number) => {
    await ctx
      .put(randomUUID(), r.token, { tipoServicio: tipo, ocurridoEn: ctx.hace(minutos) })
      .expect(200);
  };

  it('VIS-04: un sector sin historia da los dos servicios con servicio, sin eventos y con n = 0', async () => {
    const { body } = await resumen(1).expect(200);
    expect(body.sectorId).toBe(1);
    expect(typeof body.sectorNombre).toBe('string');
    expect(body.servicios.map((s: ServicioRes) => s.tipoServicio).sort()).toEqual([
      'agua',
      'electricidad',
    ]);
    for (const s of body.servicios as ServicioRes[]) {
      expect(s).toMatchObject({
        estado: 'con_servicio',
        reportesSinConfirmar: 0,
        desde: null,
        estimacion: { suficiente: false, n: 0 },
        ultimosEventos: [],
      });
    }
  });

  it('VIS-04: un corte confirmado por consenso aparece en curso en su servicio y no toca al otro (EST-05)', async () => {
    const [a, b, c] = await vecinos(3);
    await iniciar(a, 'electricidad', -20);
    await iniciar(b, 'electricidad', -15);
    await iniciar(c, 'electricidad', -10);

    const { body } = await resumen(1).expect(200);
    const luz = servicio(body, 'electricidad');
    expect(luz).toMatchObject({ estado: 'sin_servicio', reportesSinConfirmar: 0 });
    expect(luz.desde).toBe(ctx.hace(-15)); // inicio = mediana de los tres (D-007)
    expect(luz.ultimosEventos).toHaveLength(1);
    expect(luz.ultimosEventos[0]).toMatchObject({ finEn: null, duracionMin: null, sectorId: 1 });

    expect(servicio(body, 'agua')).toMatchObject({
      estado: 'con_servicio',
      desde: null,
      ultimosEventos: [],
    });
  });

  it('CON-01: con N − 1 reportes el resumen muestra los reportes sin confirmar', async () => {
    const [a, b] = await vecinos(2);
    await iniciar(a, 'agua', -10);
    await iniciar(b, 'agua', -8);
    const { body } = await resumen(1).expect(200);
    expect(servicio(body, 'agua')).toMatchObject({
      estado: 'con_servicio',
      reportesSinConfirmar: 2,
    });
  });

  it('EST-04: con menos de n_min cortes cerrados la estimación trae el n y no la cifra', async () => {
    for (let i = 0; i < 4; i++) await evento(1, 'agua', -1000 + i * 100, -940 + i * 100);
    const { body } = await resumen(1).expect(200);
    expect(servicio(body, 'agua').estimacion).toEqual({ suficiente: false, n: 4 });
  });

  it('EST-01: con n_min cortes la estimación trae mediana, cuartiles y n', async () => {
    // Duraciones 60, 120, 180, 240 y 300 min.
    for (let i = 0; i < 5; i++) {
      await evento(1, 'agua', -3000 + i * 400, -3000 + i * 400 + 60 * (i + 1));
    }
    const { body } = await resumen(1).expect(200);
    expect(servicio(body, 'agua').estimacion).toEqual({
      suficiente: true,
      n: 5,
      medianaMin: 180,
      q1Min: 120,
      q3Min: 240,
    });
    // El servicio sin cortes no hereda nada del otro (EST-05).
    expect(servicio(body, 'electricidad').estimacion).toEqual({ suficiente: false, n: 0 });
  });

  it('trae como máximo 5 eventos por servicio, el más nuevo primero, con el abierto a la cabeza', async () => {
    const ids: number[] = [];
    for (let i = 0; i < 6; i++) ids.push(await evento(1, 'agua', -1200 + i * 100, -1150 + i * 100));
    const abierto = await evento(1, 'agua', -30, null);
    await evento(2, 'agua', -50, -40); // otro sector: no entra

    const { body } = await resumen(1).expect(200);
    const eventos = servicio(body, 'agua').ultimosEventos;
    expect(eventos.map((e) => e.id)).toEqual([abierto, ids[5], ids[4], ids[3], ids[2]]);
    expect(eventos[0]).toMatchObject({ finEn: null, duracionMin: null });
    expect(eventos[1]).toMatchObject({ duracionMin: 50 });
    expect(eventos.every((e) => e.sectorId === 1)).toBe(true);
  });

  it('CON-07: leer el resumen recalcula una ventana vencida, sin depender del cron', async () => {
    const [a] = await vecinos(1);
    await iniciar(a, 'agua', -10);
    expect(servicio((await resumen(1).expect(200)).body, 'agua').reportesSinConfirmar).toBe(1);

    // Ventana de agua: 180 min. Nadie ejecuta el cron: lo corrige la propia lectura.
    ctx.ahora = new Date(ctx.ahora.getTime() + 200 * 60_000);
    const { body } = await resumen(1).expect(200);
    expect(servicio(body, 'agua')).toMatchObject({
      estado: 'con_servicio',
      reportesSinConfirmar: 0,
    });
    const [fila] = await ctx.bd
      .sql`select reportes_sin_confirmar from estado_sector where sector_id = 1 and tipo_servicio = 'agua'`;
    expect(fila.reportes_sin_confirmar).toBe(0);
  });

  it('un sector inexistente es 404 SECTOR_NO_ENCONTRADO', async () => {
    const res = await resumen(999).expect(404);
    expect(res.body.codigo).toBe('SECTOR_NO_ENCONTRADO');
  });

  it('un id que no es número o es 0 es 400 DATOS_INVALIDOS', async () => {
    expect((await resumen('abc').expect(400)).body.codigo).toBe('DATOS_INVALIDOS');
    expect((await resumen(0).expect(400)).body.codigo).toBe('DATOS_INVALIDOS');
  });

  it('VIS-04: el resumen se lee sin sesión y con una cuenta sin perfil (D-029)', async () => {
    const anonimo = await resumen(1, null).expect(200);
    expect(anonimo.body).toEqual((await resumen(1).expect(200)).body);
    // Una cuenta de Auth sin perfil (D-014) también: no devuelve nada de residentes.
    const token = await ctx.emisor.firmar({ sub: randomUUID() });
    await resumen(1, token).expect(200);
  });

  it('NF-06: la respuesta no lleva coordenadas ni datos de residentes', async () => {
    const [a, b, c] = await vecinos(3);
    await iniciar(a, 'electricidad', -20);
    await iniciar(b, 'electricidad', -15);
    await iniciar(c, 'electricidad', -10);
    const { text } = await resumen(1).expect(200);
    for (const prohibido of ['ubicacion', '"lat"', '"lng"', 'coordinates', '-68.009', '10.2075']) {
      expect(text).not.toContain(prohibido);
    }
    for (const r of [a, b, c, yo]) expect(text).not.toContain(r.id);
  });
});
