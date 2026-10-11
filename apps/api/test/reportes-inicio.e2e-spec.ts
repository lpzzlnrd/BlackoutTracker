import { randomUUID } from 'node:crypto';
import { Contexto } from './contexto';

describe('PUT /api/reportes/:id — inicio (T-021)', () => {
  let ctx: Contexto;

  beforeAll(async () => {
    ctx = await Contexto.crear();
  });
  afterAll(() => ctx.cerrar());
  beforeEach(() => ctx.reiniciar());

  const filas = () => ctx.bd.sql`select * from reportes order by inicio_en`;

  it('REP-01: guarda un corte de luz con la hora, el sector y el tipo correctos', async () => {
    const r = await ctx.residente(2);
    const id = randomUUID();
    const inicio = ctx.hace(-20);
    const res = await ctx
      .put(id, r.token, { tipoServicio: 'electricidad', ocurridoEn: inicio })
      .expect(200);
    expect(res.body).toEqual({
      id,
      tipoServicio: 'electricidad',
      sectorId: 2, // sale del residente, no del cuerpo
      inicioEn: inicio,
      finEn: null,
      duracionMin: null,
      recibidoEn: expect.any(String),
    });
    const [fila] = await filas();
    expect(fila).toMatchObject({
      id,
      residente_id: r.id,
      sector_id: 2,
      tipo_servicio: 'electricidad',
    });
    expect(fila.fin_en).toBeNull();
  });

  it('REP-02: un corte de agua queda como "agua", sin mezclarse con luz', async () => {
    const r = await ctx.residente();
    const res = await ctx
      .put(randomUUID(), r.token, { tipoServicio: 'agua', ocurridoEn: ctx.hace(-5) })
      .expect(200);
    expect(res.body.tipoServicio).toBe('agua');
    expect((await filas()).map((f) => f.tipo_servicio)).toEqual(['agua']);
  });

  it('REP-05: un segundo reporte abierto del mismo servicio → 409 REPORTE_ABIERTO_DUPLICADO', async () => {
    const r = await ctx.residente();
    await ctx
      .put(randomUUID(), r.token, { tipoServicio: 'agua', ocurridoEn: ctx.hace(-30) })
      .expect(200);
    const res = await ctx
      .put(randomUUID(), r.token, { tipoServicio: 'agua', ocurridoEn: ctx.hace(-10) })
      .expect(409);
    expect(res.body).toMatchObject({ codigo: 'REPORTE_ABIERTO_DUPLICADO' });
    expect(await filas()).toHaveLength(1);
  });

  it('REP-05: otro residente sí puede abrir el mismo servicio en el mismo sector', async () => {
    const a = await ctx.residente();
    const b = await ctx.residente();
    await ctx
      .put(randomUUID(), a.token, { tipoServicio: 'agua', ocurridoEn: ctx.hace(-30) })
      .expect(200);
    await ctx
      .put(randomUUID(), b.token, { tipoServicio: 'agua', ocurridoEn: ctx.hace(-25) })
      .expect(200);
    expect(await filas()).toHaveLength(2);
  });

  it('REP-06: uno de agua y uno de luz abiertos a la vez conviven', async () => {
    const r = await ctx.residente();
    await ctx
      .put(randomUUID(), r.token, { tipoServicio: 'agua', ocurridoEn: ctx.hace(-30) })
      .expect(200);
    await ctx
      .put(randomUUID(), r.token, { tipoServicio: 'electricidad', ocurridoEn: ctx.hace(-20) })
      .expect(200);
    expect((await filas()).map((f) => f.tipo_servicio).sort()).toEqual(['agua', 'electricidad']);
  });

  it('OFF-03: enviado ahora con ocurridoEn de hace 90 min, se guarda la hora del evento', async () => {
    const r = await ctx.residente();
    const inicio = ctx.hace(-90);
    await ctx
      .put(randomUUID(), r.token, { tipoServicio: 'electricidad', ocurridoEn: inicio })
      .expect(200);
    const [fila] = await filas();
    expect(new Date(fila.inicio_en as string).toISOString()).toBe(inicio);
    // El rastro del envío diferido: llegó después de ocurrir.
    expect(new Date(fila.recibido_en as string).getTime()).toBeGreaterThan(
      new Date(inicio).getTime(),
    );
  });

  it('OFF-05: el mismo PUT dos veces seguidas → 1 fila y la misma respuesta', async () => {
    const r = await ctx.residente();
    const id = randomUUID();
    const cuerpo = { tipoServicio: 'agua', ocurridoEn: ctx.hace(-15) };
    const a = await ctx.put(id, r.token, cuerpo).expect(200);
    const b = await ctx.put(id, r.token, cuerpo).expect(200);
    expect(b.body).toEqual(a.body);
    expect(await filas()).toHaveLength(1);
  });

  it('OFF-05: el mismo PUT dos veces en paralelo → 1 fila y 2 respuestas 200', async () => {
    const r = await ctx.residente();
    const id = randomUUID();
    const cuerpo = { tipoServicio: 'electricidad', ocurridoEn: ctx.hace(-15) };
    const [a, b] = await Promise.all([ctx.put(id, r.token, cuerpo), ctx.put(id, r.token, cuerpo)]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(b.body).toEqual(a.body);
    expect(await filas()).toHaveLength(1);
  });

  it('el mismo id con otro contenido → 409 REPORTE_CONFLICTO y no se modifica nada', async () => {
    const r = await ctx.residente();
    const id = randomUUID();
    const inicio = ctx.hace(-15);
    await ctx.put(id, r.token, { tipoServicio: 'agua', ocurridoEn: inicio }).expect(200);
    for (const otro of [
      { tipoServicio: 'electricidad', ocurridoEn: inicio },
      { tipoServicio: 'agua', ocurridoEn: ctx.hace(-14) },
    ]) {
      const res = await ctx.put(id, r.token, otro).expect(409);
      expect(res.body.codigo).toBe('REPORTE_CONFLICTO');
    }
    const [fila] = await filas();
    expect(fila).toMatchObject({ tipo_servicio: 'agua' });
    expect(new Date(fila.inicio_en as string).toISOString()).toBe(inicio);
  });

  it('el id de un reporte ajeno → 409 REPORTE_CONFLICTO (sin revelar de quién es)', async () => {
    const a = await ctx.residente();
    const b = await ctx.residente();
    const id = randomUUID();
    const cuerpo = { tipoServicio: 'agua', ocurridoEn: ctx.hace(-15) };
    await ctx.put(id, a.token, cuerpo).expect(200);
    const res = await ctx.put(id, b.token, cuerpo).expect(409);
    expect(res.body.codigo).toBe('REPORTE_CONFLICTO');
    expect(await filas()).toHaveLength(1);
  });

  it('REP-07/OFF-03: una hora en el futuro o de hace más de 7 días → 422 HORA_INVALIDA', async () => {
    const r = await ctx.residente();
    for (const ocurridoEn of [ctx.hace(10), ctx.hace(-7 * 24 * 60 - 1)]) {
      const res = await ctx
        .put(randomUUID(), r.token, { tipoServicio: 'agua', ocurridoEn })
        .expect(422);
      expect(res.body.codigo).toBe('HORA_INVALIDA');
    }
    expect(await filas()).toHaveLength(0);
  });

  it('un cuerpo o un id inválidos → 400 DATOS_INVALIDOS', async () => {
    const r = await ctx.residente();
    for (const malo of [
      { tipoServicio: 'gas', ocurridoEn: ctx.hace(-5) },
      { tipoServicio: 'agua', ocurridoEn: 'ayer por la tarde' },
      { tipoServicio: 'agua' },
      { tipoServicio: 'agua', ocurridoEn: '2026-10-07T10:30:00' }, // sin zona horaria
      { tipoServicio: 'agua', ocurridoEn: ctx.hace(-5), sectorId: 3 },
    ]) {
      const res = await ctx.put(randomUUID(), r.token, malo).expect(400);
      expect(res.body.codigo).toBe('DATOS_INVALIDOS');
    }
    await ctx
      .put('no-es-un-uuid', r.token, { tipoServicio: 'agua', ocurridoEn: ctx.hace(-5) })
      .expect(400);
  });

  it('sin token → 401; con token pero sin perfil → 403 REGISTRO_INCOMPLETO', async () => {
    const cuerpo = { tipoServicio: 'agua', ocurridoEn: ctx.hace(-5) };
    await ctx.put(randomUUID(), undefined, cuerpo).expect(401);
    const sinPerfil = await ctx.emisor.firmar({ sub: randomUUID() });
    const res = await ctx.put(randomUUID(), sinPerfil, cuerpo).expect(403);
    expect(res.body.codigo).toBe('REGISTRO_INCOMPLETO');
  });

  it('NF-06: la respuesta no trae residente ni coordenadas', async () => {
    const r = await ctx.residente();
    const res = await ctx
      .put(randomUUID(), r.token, { tipoServicio: 'agua', ocurridoEn: ctx.hace(-5) })
      .expect(200);
    expect(Object.keys(res.body).sort()).toEqual(
      ['duracionMin', 'finEn', 'id', 'inicioEn', 'recibidoEn', 'sectorId', 'tipoServicio'].sort(),
    );
  });
});
