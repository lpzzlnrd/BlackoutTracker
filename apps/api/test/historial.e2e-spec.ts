import { randomUUID } from 'node:crypto';
import { Contexto } from './contexto';

interface EventoRes {
  id: number;
  inicioEn: string;
  finEn: string;
  duracionMin: number;
  tipoServicio: string;
  sectorId: number;
}

describe('GET /api/sectores/:id/historial (T-034)', () => {
  let ctx: Contexto;

  beforeAll(async () => {
    ctx = await Contexto.crear();
  });
  afterAll(() => ctx.cerrar());
  beforeEach(() => ctx.reiniciar());

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

  it('devuelve solo cerrados, del sector pedido, el de fin más reciente primero y con duración', async () => {
    const yo = await ctx.residente();
    const viejo = await evento(1, 'agua', -600, -540);
    const nuevo = await evento(1, 'electricidad', -300, -120);
    await evento(1, 'agua', -30, null); // abierto: no sale
    await evento(2, 'agua', -200, -100); // otro sector: no sale

    const res = await ctx.get('/api/sectores/1/historial', yo.token).expect(200);
    expect(res.body.siguienteCursor).toBeNull();
    expect(res.body.eventos.map((e: EventoRes) => e.id)).toEqual([nuevo, viejo]);
    expect(res.body.eventos[0]).toMatchObject({
      sectorId: 1,
      tipoServicio: 'electricidad',
      duracionMin: 180,
      origen: 'consenso',
    });
    expect(res.body.eventos[1].duracionMin).toBe(60);
  });

  it('filtra por tipoServicio', async () => {
    const yo = await ctx.residente();
    const agua = await evento(1, 'agua', -300, -200);
    await evento(1, 'electricidad', -100, -50);

    const res = await ctx.get('/api/sectores/1/historial?tipoServicio=agua', yo.token).expect(200);
    expect(res.body.eventos.map((e: EventoRes) => e.id)).toEqual([agua]);
  });

  it('pagina por cursor sin repetir ni saltar eventos, también con el mismo fin', async () => {
    const yo = await ctx.residente();
    const ids: number[] = [];
    for (let i = 0; i < 7; i += 1)
      ids.push(await evento(1, i % 2 ? 'agua' : 'electricidad', -500 + i * 10, -400 + i * 10));
    // Dos eventos más con exactamente el mismo fin que el último: el desempate es el id.
    ids.push(await evento(1, 'agua', -450, -340));
    ids.push(await evento(1, 'electricidad', -440, -340));
    await evento(1, 'agua', -5, null);
    const esperado = (
      await ctx.bd.sql<{ id: number }[]>`
        select id from eventos_sector where fin_en is not null order by fin_en desc, id desc`
    ).map((f) => f.id);

    const vistos: number[] = [];
    let cursor: string | null = null;
    let paginas = 0;
    do {
      const url: string = `/api/sectores/1/historial?limite=2${cursor ? `&cursor=${cursor}` : ''}`;
      const res = await ctx.get(url, yo.token).expect(200);
      expect(res.body.eventos.length).toBeLessThanOrEqual(2);
      vistos.push(...res.body.eventos.map((e: EventoRes) => e.id));
      cursor = res.body.siguienteCursor;
      paginas += 1;
      // Llegan eventos nuevos entre páginas: no deben alterar lo que falta por ver.
      if (paginas === 1) await evento(1, 'agua', -2, -1);
    } while (cursor);

    expect(paginas).toBe(5);
    expect(new Set(vistos).size).toBe(vistos.length);
    expect(vistos).toEqual(esperado);
    expect(vistos).toHaveLength(ids.length);
  });

  it('la última página exacta no deja cursor', async () => {
    const yo = await ctx.residente();
    await evento(1, 'agua', -300, -200);
    await evento(1, 'agua', -100, -50);
    const res = await ctx.get('/api/sectores/1/historial?limite=2', yo.token).expect(200);
    expect(res.body.eventos).toHaveLength(2);
    expect(res.body.siguienteCursor).toBeNull();
  });

  it('sin eventos devuelve una lista vacía', async () => {
    const yo = await ctx.residente();
    const res = await ctx.get('/api/sectores/1/historial', yo.token).expect(200);
    expect(res.body).toEqual({ eventos: [], siguienteCursor: null });
  });

  it('el límite por defecto es 20 y el máximo 50', async () => {
    const yo = await ctx.residente();
    await ctx.bd.sql`
      insert into eventos_sector (sector_id, tipo_servicio, inicio_en, fin_en, confirmado_en)
      select 1, 'agua', now() - make_interval(mins => n * 10 + 5), now() - make_interval(mins => n * 10), now()
      from generate_series(1, 55) n`;
    const porDefecto = await ctx.get('/api/sectores/1/historial', yo.token).expect(200);
    expect(porDefecto.body.eventos).toHaveLength(20);
    const maximo = await ctx.get('/api/sectores/1/historial?limite=50', yo.token).expect(200);
    expect(maximo.body.eventos).toHaveLength(50);
    await ctx.get('/api/sectores/1/historial?limite=51', yo.token).expect(400);
  });

  it('sector inexistente → 404 SECTOR_NO_ENCONTRADO', async () => {
    const yo = await ctx.residente();
    const res = await ctx.get('/api/sectores/9999/historial', yo.token).expect(404);
    expect(res.body.codigo).toBe('SECTOR_NO_ENCONTRADO');
  });

  it.each([
    '/api/sectores/abc/historial',
    '/api/sectores/0/historial',
    '/api/sectores/1.5/historial',
    '/api/sectores/99999999999/historial',
    '/api/sectores/1/historial?tipoServicio=gas',
    '/api/sectores/1/historial?limite=0',
    '/api/sectores/1/historial?limite=x',
    '/api/sectores/1/historial?cursor=basura',
    '/api/sectores/1/historial?cursor=!!!',
    '/api/sectores/1/historial?otro=1',
  ])('parámetros inválidos → 400 DATOS_INVALIDOS: %s', async (ruta) => {
    const yo = await ctx.residente();
    const res = await ctx.get(ruta, yo.token).expect(400);
    expect(res.body.codigo).toBe('DATOS_INVALIDOS');
  });

  it('sin token → 401; con JWT pero sin perfil de residente → 200 (solo pide JWT)', async () => {
    await ctx.get('/api/sectores/1/historial').expect(401);
    const sinPerfil = await ctx.emisor.firmar({ sub: randomUUID() });
    await ctx.get('/api/sectores/1/historial', sinPerfil).expect(200);
  });

  it('NF-06: los elementos no traen coordenadas ni datos de residentes', async () => {
    const yo = await ctx.residente();
    await evento(1, 'agua', -300, -200);
    const res = await ctx.get('/api/sectores/1/historial', yo.token).expect(200);
    expect(Object.keys(res.body).sort()).toEqual(['eventos', 'siguienteCursor']);
    expect(Object.keys(res.body.eventos[0]).sort()).toEqual(
      [
        'confirmadoEn',
        'duracionMin',
        'finEn',
        'id',
        'inicioEn',
        'origen',
        'sectorId',
        'tipoServicio',
      ].sort(),
    );
    const texto = JSON.stringify(res.body);
    expect(texto).not.toMatch(/residente|ubicacion|lat|lng|coordinates/i);
    expect(texto).not.toContain(yo.id);
  });
});
