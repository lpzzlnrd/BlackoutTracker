import { randomUUID } from 'node:crypto';
import { Contexto, type ResidentePrueba } from './contexto';

describe('PATCH /api/reportes/:id/cierre (T-022)', () => {
  let ctx: Contexto;

  beforeAll(async () => {
    ctx = await Contexto.crear();
  });
  afterAll(() => ctx.cerrar());
  beforeEach(() => ctx.reiniciar());

  const fila = async (id: string) => {
    const [f] = await ctx.bd.sql`select * from reportes where id = ${id}`;
    return f;
  };

  /** Abre un reporte `minAtras` minutos antes de `ahora`. */
  const abrir = async (r: ResidentePrueba, minAtras: number, tipoServicio = 'electricidad') => {
    const id = randomUUID();
    await ctx.put(id, r.token, { tipoServicio, ocurridoEn: ctx.hace(-minAtras) }).expect(200);
    return id;
  };

  it('REP-03: cierra el reporte, calcula la duración y deja libre el servicio', async () => {
    const r = await ctx.residente();
    const id = await abrir(r, 120);
    const res = await ctx.patch(id, r.token, { ocurridoEn: ctx.hace(-30) }).expect(200);
    expect(res.body).toMatchObject({
      id,
      finEn: ctx.hace(-30),
      duracionMin: 90,
      tipoServicio: 'electricidad',
    });
    const f = await fila(id);
    expect(new Date(f.fin_en as string).toISOString()).toBe(ctx.hace(-30));
    expect(f.cerrado_recibido_en).not.toBeNull();
    // Cerrado el ciclo, el residente puede abrir otro del mismo servicio (REP-05 solo bloquea abiertos).
    await abrir(r, 5);
  });

  it('REP-04: cerrar un id que no existe → 404 REPORTE_NO_ENCONTRADO (se bloquea, D-003)', async () => {
    const r = await ctx.residente();
    const res = await ctx.patch(randomUUID(), r.token, { ocurridoEn: ctx.hace(-5) }).expect(404);
    expect(res.body).toMatchObject({ codigo: 'REPORTE_NO_ENCONTRADO' });
  });

  it('REP-04: cerrar el reporte de otro residente → 404 y el reporte no se toca', async () => {
    const a = await ctx.residente();
    const b = await ctx.residente();
    const id = await abrir(a, 60);
    await ctx.patch(id, b.token, { ocurridoEn: ctx.hace(-5) }).expect(404);
    expect((await fila(id)).fin_en).toBeNull();
  });

  it('REP-07: un fin anterior al inicio → 422 HORA_INVALIDA y no se guarda nada', async () => {
    const r = await ctx.residente();
    const id = await abrir(r, 60);
    const res = await ctx.patch(id, r.token, { ocurridoEn: ctx.hace(-90) }).expect(422);
    expect(res.body).toMatchObject({ codigo: 'HORA_INVALIDA' });
    const f = await fila(id);
    expect(f.fin_en).toBeNull();
    expect(f.cerrado_recibido_en).toBeNull();
  });

  it('REP-07: un fin en el futuro → 422; un fin igual al inicio (duración cero) → 200', async () => {
    const r = await ctx.residente();
    const id = await abrir(r, 60);
    await ctx.patch(id, r.token, { ocurridoEn: ctx.hace(10) }).expect(422);
    const res = await ctx.patch(id, r.token, { ocurridoEn: ctx.hace(-60) }).expect(200);
    expect(res.body.duracionMin).toBe(0);
  });

  it('OFF-05: cerrar dos veces con la misma hora → 200 las dos y la misma respuesta', async () => {
    const r = await ctx.residente();
    const id = await abrir(r, 120);
    const cuerpo = { ocurridoEn: ctx.hace(-30) };
    const a = await ctx.patch(id, r.token, cuerpo).expect(200);
    const b = await ctx.patch(id, r.token, cuerpo).expect(200);
    expect(b.body).toEqual(a.body);
  });

  it('OFF-05: el mismo cierre dos veces en paralelo → 200 las dos', async () => {
    const r = await ctx.residente();
    const id = await abrir(r, 120);
    const cuerpo = { ocurridoEn: ctx.hace(-30) };
    const [a, b] = await Promise.all([
      ctx.patch(id, r.token, cuerpo),
      ctx.patch(id, r.token, cuerpo),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(b.body).toEqual(a.body);
  });

  it('cerrar de nuevo con otra hora → 409 REPORTE_CONFLICTO y el fin no cambia', async () => {
    const r = await ctx.residente();
    const id = await abrir(r, 120);
    await ctx.patch(id, r.token, { ocurridoEn: ctx.hace(-30) }).expect(200);
    const res = await ctx.patch(id, r.token, { ocurridoEn: ctx.hace(-20) }).expect(409);
    expect(res.body.codigo).toBe('REPORTE_CONFLICTO');
    expect(new Date((await fila(id)).fin_en as string).toISOString()).toBe(ctx.hace(-30));
  });

  it('el cierre de agua no toca un reporte de luz abierto (REP-06)', async () => {
    const r = await ctx.residente();
    const luz = await abrir(r, 90, 'electricidad');
    const agua = await abrir(r, 60, 'agua');
    await ctx.patch(agua, r.token, { ocurridoEn: ctx.hace(-10) }).expect(200);
    expect((await fila(luz)).fin_en).toBeNull();
    expect((await fila(agua)).fin_en).not.toBeNull();
  });

  it('un cuerpo o un id inválidos → 400; sin token → 401; sin perfil → 403', async () => {
    const r = await ctx.residente();
    const id = await abrir(r, 60);
    for (const malo of [
      {},
      { ocurridoEn: 'hoy' },
      { ocurridoEn: '2026-10-07T10:30:00' },
      { ocurridoEn: ctx.hace(-5), extra: 1 },
    ]) {
      const res = await ctx.patch(id, r.token, malo).expect(400);
      expect(res.body.codigo).toBe('DATOS_INVALIDOS');
    }
    await ctx.patch('no-es-un-uuid', r.token, { ocurridoEn: ctx.hace(-5) }).expect(400);
    await ctx.patch(id, undefined, { ocurridoEn: ctx.hace(-5) }).expect(401);
    const sinPerfil = await ctx.emisor.firmar({ sub: randomUUID() });
    const res = await ctx.patch(id, sinPerfil, { ocurridoEn: ctx.hace(-5) }).expect(403);
    expect(res.body.codigo).toBe('REGISTRO_INCOMPLETO');
  });
});
