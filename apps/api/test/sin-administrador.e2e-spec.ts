import { randomUUID } from 'node:crypto';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Contexto } from './contexto';

/**
 * NF-07 (sin administrador): todo funciona con cuentas de residente y nadie tiene más poder que
 * otro. Se comprueba de tres formas:
 *   1. No hay rutas de administración ni de moderación, ni operaciones de borrado.
 *   2. No hay columnas de rol o permisos en la base, y un token con claims de administrador de
 *      Supabase (`role: service_role`, `app_metadata`) no da ningún permiso extra.
 *   3. El estado de un sector solo cambia por consenso: un residente solo no puede forzarlo, y el
 *      ciclo completo (corte y restablecimiento) se cumple solo con residentes comunes.
 */
describe('Sin administrador (NF-07)', () => {
  let ctx: Contexto;

  beforeAll(async () => {
    ctx = await Contexto.crear();
  });
  afterAll(() => ctx.cerrar());
  beforeEach(() => ctx.reiniciar());

  const estado = async (sectorId: number, tipo: string) => {
    const [fila] = await ctx.bd.sql`
      select estado, reportes_sin_confirmar from estado_sector
      where sector_id = ${sectorId} and tipo_servicio = ${tipo}`;
    return fila;
  };

  it('NF-07: no hay rutas de administración, moderación ni borrado', () => {
    const doc = SwaggerModule.createDocument(ctx.app, new DocumentBuilder().build());
    const operaciones = Object.entries(doc.paths).flatMap(([ruta, item]) =>
      (['get', 'post', 'put', 'patch', 'delete'] as const)
        .filter((m) => item[m])
        .map((m) => `${m.toUpperCase()} ${ruta}`),
    );
    expect(operaciones.length).toBeGreaterThan(0);
    expect(operaciones.filter((o) => /admin|moder|rol|usuarios|forzar/i.test(o))).toEqual([]);
    expect(operaciones.filter((o) => o.startsWith('DELETE '))).toEqual([]);
  });

  it('NF-07: la base no tiene columnas de rol ni de permisos', async () => {
    const columnas = await ctx.bd.sql`
      select table_name, column_name from information_schema.columns
      where table_schema = 'public'
        and column_name ~* '^(rol|roles|role|es_admin|is_admin|admin|moderador|permisos?)$'`;
    expect(columnas).toEqual([]);
  });

  it('NF-07: un token con claims de administrador no fuerza el estado ni toca reportes ajenos', async () => {
    const vecino = await ctx.residente(1);
    const idVecino = randomUUID();
    await ctx
      .put(idVecino, vecino.token, { tipoServicio: 'electricidad', ocurridoEn: ctx.hace(-10) })
      .expect(200);

    // Un residente con un token "de administrador" de Supabase sigue siendo un residente más.
    const comun = await ctx.residente(1);
    const tokenAdmin = await ctx.emisor.firmar({
      sub: comun.id,
      claims: { role: 'service_role', app_metadata: { rol: 'admin', provider: 'email' } },
    });
    await ctx
      .put(randomUUID(), tokenAdmin, { tipoServicio: 'electricidad', ocurridoEn: ctx.hace(-5) })
      .expect(200);

    // Dos de tres: el sector sigue con servicio y solo hay reportes sin confirmar.
    expect(await estado(1, 'electricidad')).toMatchObject({
      estado: 'con_servicio',
      reportes_sin_confirmar: 2,
    });
    // Y no puede cerrar el reporte de otro residente (404, igual que un id inexistente).
    await ctx.patch(idVecino, tokenAdmin, { ocurridoEn: ctx.hace(-1) }).expect(404);
  });

  it('NF-07: el ciclo completo (corte y restablecimiento) se cumple solo con residentes comunes', async () => {
    const vecinos = await Promise.all([1, 2, 3].map(() => ctx.residente(2)));
    const ids = vecinos.map(() => randomUUID());

    for (const [i, v] of vecinos.entries()) {
      await ctx
        .put(ids[i], v.token, { tipoServicio: 'agua', ocurridoEn: ctx.hace(-60 + i) })
        .expect(200);
    }
    expect(await estado(2, 'agua')).toMatchObject({ estado: 'sin_servicio' });

    for (const [i, v] of vecinos.entries()) {
      await ctx.patch(ids[i], v.token, { ocurridoEn: ctx.hace(-10 + i) }).expect(200);
    }
    expect(await estado(2, 'agua')).toMatchObject({
      estado: 'con_servicio',
      reportes_sin_confirmar: 0,
    });
  });
});
