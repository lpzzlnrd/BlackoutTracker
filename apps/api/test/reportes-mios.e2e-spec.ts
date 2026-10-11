import { randomUUID } from 'node:crypto';
import { Contexto, type ResidentePrueba } from './contexto';

describe('GET /api/reportes/mios (T-023)', () => {
  let ctx: Contexto;

  beforeAll(async () => {
    ctx = await Contexto.crear();
  });
  afterAll(() => ctx.cerrar());
  beforeEach(() => ctx.reiniciar());

  const abrir = async (r: ResidentePrueba, minAtras: number, tipoServicio = 'electricidad') => {
    const id = randomUUID();
    await ctx.put(id, r.token, { tipoServicio, ocurridoEn: ctx.hace(-minAtras) }).expect(200);
    return id;
  };

  it('devuelve solo los reportes del propio residente, el más reciente primero', async () => {
    const yo = await ctx.residente();
    const otro = await ctx.residente();
    const viejo = await abrir(yo, 120, 'agua');
    const nuevo = await abrir(yo, 10, 'electricidad');
    await abrir(otro, 30, 'agua');

    const res = await ctx.get('/api/reportes/mios', yo.token).expect(200);
    expect(res.body.map((r: { id: string }) => r.id)).toEqual([nuevo, viejo]);
    // El residente nunca ve reportes de otros, ni siquiera del mismo sector.
    expect(res.body).toHaveLength(2);
  });

  it('abiertos=true excluye los cerrados y los vencidos', async () => {
    const yo = await ctx.residente();
    const cerrado = await abrir(yo, 120, 'agua');
    await ctx.patch(cerrado, yo.token, { ocurridoEn: ctx.hace(-60) }).expect(200);
    const vencido = await abrir(yo, 90, 'electricidad');
    await ctx.bd.sql`update reportes set vencido = true where id = ${vencido}`;
    const abierto = await abrir(yo, 5, 'electricidad');

    const abiertos = await ctx.get('/api/reportes/mios?abiertos=true', yo.token).expect(200);
    expect(abiertos.body.map((r: { id: string }) => r.id)).toEqual([abierto]);
    expect(abiertos.body[0]).toMatchObject({ finEn: null, duracionMin: null });

    const todos = await ctx.get('/api/reportes/mios?abiertos=false', yo.token).expect(200);
    expect(todos.body).toHaveLength(3);
    const sinFiltro = await ctx.get('/api/reportes/mios', yo.token).expect(200);
    expect(sinFiltro.body).toHaveLength(3);
  });

  it('un cierre aparece con su duración', async () => {
    const yo = await ctx.residente();
    const id = await abrir(yo, 120);
    await ctx.patch(id, yo.token, { ocurridoEn: ctx.hace(-30) }).expect(200);
    const res = await ctx.get('/api/reportes/mios', yo.token).expect(200);
    expect(res.body).toEqual([expect.objectContaining({ id, duracionMin: 90 })]);
  });

  it('sin reportes devuelve una lista vacía', async () => {
    const yo = await ctx.residente();
    const res = await ctx.get('/api/reportes/mios?abiertos=true', yo.token).expect(200);
    expect(res.body).toEqual([]);
  });

  it('NF-06: los elementos no traen residente ni coordenadas', async () => {
    const yo = await ctx.residente();
    await abrir(yo, 10);
    const res = await ctx.get('/api/reportes/mios', yo.token).expect(200);
    expect(Object.keys(res.body[0]).sort()).toEqual(
      ['duracionMin', 'finEn', 'id', 'inicioEn', 'recibidoEn', 'sectorId', 'tipoServicio'].sort(),
    );
  });

  it('abiertos con un valor que no es booleano → 400; sin token → 401; sin perfil → 403', async () => {
    const yo = await ctx.residente();
    const res = await ctx.get('/api/reportes/mios?abiertos=quizas', yo.token).expect(400);
    expect(res.body.codigo).toBe('DATOS_INVALIDOS');
    await ctx.get('/api/reportes/mios').expect(401);
    const sinPerfil = await ctx.emisor.firmar({ sub: randomUUID() });
    const r403 = await ctx.get('/api/reportes/mios', sinPerfil).expect(403);
    expect(r403.body.codigo).toBe('REGISTRO_INCOMPLETO');
  });
});
