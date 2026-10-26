import { randomUUID } from 'node:crypto';
import { ConsensoCron } from '../src/consenso/consenso.cron';
import { ConsensoService } from '../src/consenso/consenso.service';
import { Contexto, type ResidentePrueba } from './contexto';

describe('Consenso de sector — ConsensoService (T-032)', () => {
  let ctx: Contexto;

  beforeAll(async () => {
    ctx = await Contexto.crear();
  });
  afterAll(() => ctx.cerrar());
  beforeEach(() => ctx.reiniciar());

  const estado = async (sectorId: number, tipo: string) => {
    const [fila] = await ctx.bd.sql`
      select * from estado_sector where sector_id = ${sectorId} and tipo_servicio = ${tipo}`;
    return fila;
  };
  const eventos = () => ctx.bd.sql`select * from eventos_sector order by id`;

  /** Varios residentes del mismo sector. */
  const vecinos = (n: number, sectorId = 1): Promise<ResidentePrueba[]> =>
    Promise.all(Array.from({ length: n }, () => ctx.residente(sectorId)));

  /** Un inicio del residente; devuelve el id del reporte. */
  const iniciar = async (r: ResidentePrueba, tipo: string, minutos: number): Promise<string> => {
    const id = randomUUID();
    await ctx.put(id, r.token, { tipoServicio: tipo, ocurridoEn: ctx.hace(minutos) }).expect(200);
    return id;
  };
  const cerrar = (r: ResidentePrueba, id: string, minutos: number) =>
    ctx.patch(id, r.token, { ocurridoEn: ctx.hace(minutos) }).expect(200);

  it('CON-01: con N − 1 reportes el estado no cambia y se muestran 2 sin confirmar', async () => {
    const [a, b] = await vecinos(2);
    await iniciar(a, 'electricidad', -10);
    expect((await estado(1, 'electricidad')).reportes_sin_confirmar).toBe(1);
    await iniciar(b, 'electricidad', -8);

    expect(await estado(1, 'electricidad')).toMatchObject({
      estado: 'con_servicio',
      reportes_sin_confirmar: 2,
      evento_id: null,
    });
    expect(await eventos()).toHaveLength(0);
  });

  it('CON-02: N reportes de residentes distintos confirman el corte (inicio = mediana)', async () => {
    const [a, b, c] = await vecinos(3);
    await iniciar(a, 'electricidad', -20);
    await iniciar(b, 'electricidad', -15);
    await iniciar(c, 'electricidad', -10);

    const evs = await eventos();
    expect(evs).toHaveLength(1);
    expect(evs[0]).toMatchObject({ sector_id: 1, tipo_servicio: 'electricidad', fin_en: null });
    expect(new Date(evs[0].inicio_en).toISOString()).toBe(ctx.hace(-15));
    expect(await estado(1, 'electricidad')).toMatchObject({
      estado: 'sin_servicio',
      reportes_sin_confirmar: 0,
      evento_id: evs[0].id,
    });
    // El otro servicio del mismo sector no se toca.
    expect((await estado(1, 'agua')).estado).toBe('con_servicio');
  });

  it('CON-04: varios reportes del mismo usuario cuentan como uno', async () => {
    const [a, b] = await vecinos(2);
    // El mismo usuario reporta, cierra y vuelve a reportar: sigue siendo un solo residente.
    const primero = await iniciar(a, 'agua', -30);
    await cerrar(a, primero, -25);
    await iniciar(a, 'agua', -20);
    await iniciar(b, 'agua', -10);

    expect(await eventos()).toHaveLength(0);
    expect((await estado(1, 'agua')).reportes_sin_confirmar).toBe(2);
  });

  it('CON-03: 4 PUT concurrentes de residentes distintos → un solo evento', async () => {
    const rs = await vecinos(4);
    await Promise.all(
      rs.map((r, i) =>
        ctx
          .put(randomUUID(), r.token, {
            tipoServicio: 'electricidad',
            ocurridoEn: ctx.hace(-10 - i),
          })
          .expect(200),
      ),
    );
    expect(await eventos()).toHaveLength(1);
    expect(await estado(1, 'electricidad')).toMatchObject({ estado: 'sin_servicio' });
  });

  it('CON-03: con N + 1 reportes secuenciales no se duplica el evento', async () => {
    const rs = await vecinos(5);
    for (const [i, r] of rs.entries()) await iniciar(r, 'electricidad', -20 + i);
    expect(await eventos()).toHaveLength(1);
  });

  it('CON-05: los reportes de sectores distintos no se suman', async () => {
    const [a, b] = await vecinos(2, 1);
    const [c] = await vecinos(1, 2);
    await iniciar(a, 'electricidad', -10);
    await iniciar(b, 'electricidad', -9);
    await iniciar(c, 'electricidad', -8);

    expect(await eventos()).toHaveLength(0);
    expect((await estado(1, 'electricidad')).reportes_sin_confirmar).toBe(2);
    expect((await estado(2, 'electricidad')).reportes_sin_confirmar).toBe(1);
  });

  it('CON-05: agua y luz del mismo sector no se suman entre sí', async () => {
    const [a, b, c] = await vecinos(3);
    await iniciar(a, 'electricidad', -10);
    await iniciar(b, 'electricidad', -9);
    await iniciar(c, 'agua', -8);
    expect(await eventos()).toHaveLength(0);
  });

  it('CON-07: reportes más separados que la ventana no confirman', async () => {
    const [a, b, c] = await vecinos(3);
    // Ventana de luz: 30 min. Entre el primero y el último pasan 60.
    await iniciar(a, 'electricidad', -70);
    await iniciar(b, 'electricidad', -40);
    await iniciar(c, 'electricidad', -10);
    expect(await eventos()).toHaveLength(0);
  });

  it('CON-07: al vencer la ventana, reportes_sin_confirmar vuelve a 0 (cron, reloj controlado)', async () => {
    const [a, b] = await vecinos(2);
    await iniciar(a, 'electricidad', -10);
    await iniciar(b, 'electricidad', -8);
    expect((await estado(1, 'electricidad')).reportes_sin_confirmar).toBe(2);

    // Dentro de la ventana (30 min) el barrido no cambia nada.
    ctx.ahora = new Date(ctx.ahora.getTime() + 15 * 60_000);
    await ctx.app.get(ConsensoCron).ejecutar();
    expect((await estado(1, 'electricidad')).reportes_sin_confirmar).toBe(2);

    // Pasada la ventana, los reportes dejan de contar. Sin evento ni cambio de estado.
    ctx.ahora = new Date(ctx.ahora.getTime() + 20 * 60_000);
    await ctx.app.get(ConsensoCron).ejecutar();
    expect(await estado(1, 'electricidad')).toMatchObject({
      estado: 'con_servicio',
      reportes_sin_confirmar: 0,
      evento_id: null,
    });
    expect(await eventos()).toHaveLength(0);
  });

  it('CON-07: leer un par con estado viejo lo recalcula (sin depender del cron)', async () => {
    const [a] = await vecinos(1);
    await iniciar(a, 'agua', -10);
    expect((await estado(1, 'agua')).reportes_sin_confirmar).toBe(1);

    // Ventana de agua: 180 min.
    ctx.ahora = new Date(ctx.ahora.getTime() + 200 * 60_000);
    await ctx.app.get(ConsensoService).refrescarSiViejo(1, 'agua');
    expect((await estado(1, 'agua')).reportes_sin_confirmar).toBe(0);
  });

  it('CON-07: el barrido no toca los pares sin reportes sin confirmar', async () => {
    const [a, b, c] = await vecinos(3);
    await iniciar(a, 'electricidad', -20);
    await iniciar(b, 'electricidad', -15);
    await iniciar(c, 'electricidad', -10);
    const antes = await estado(1, 'electricidad');

    ctx.ahora = new Date(ctx.ahora.getTime() + 60 * 60_000);
    expect(await ctx.app.get(ConsensoService).reevaluarVencidos()).toBe(0);
    expect(await estado(1, 'electricidad')).toEqual(antes);
  });

  it('CON-06: N cierres confirman el restablecimiento y cierran el evento', async () => {
    const rs = await vecinos(4);
    const ids: string[] = [];
    for (const [i, r] of rs.entries()) ids.push(await iniciar(r, 'electricidad', -60 + i));

    // Dos cierres no bastan (hay reportes abiertos y falta N).
    await cerrar(rs[0], ids[0], -20);
    await cerrar(rs[1], ids[1], -18);
    expect((await eventos())[0].fin_en).toBeNull();
    expect((await estado(1, 'electricidad')).estado).toBe('sin_servicio');

    // El tercero completa N: fin del evento = mediana de los tres (-20, -18, -16).
    await cerrar(rs[2], ids[2], -16);
    const [ev] = await eventos();
    expect(new Date(ev.fin_en).toISOString()).toBe(ctx.hace(-18));
    expect(ev.restablecido_en).not.toBeNull();
    expect(await estado(1, 'electricidad')).toMatchObject({
      estado: 'con_servicio',
      evento_id: null,
    });
  });

  it('CON-06: si ya no queda ningún reporte abierto, el evento se cierra aunque cerraron menos de N', async () => {
    const rs = await vecinos(3);
    const ids: string[] = [];
    for (const [i, r] of rs.entries()) ids.push(await iniciar(r, 'agua', -600 + i));
    // Los cierres están separados más que la ventana de agua (180 min): no hay N en una ventana,
    // así que el evento solo se cierra cuando se cierra el último reporte abierto.
    await cerrar(rs[0], ids[0], -500);
    await cerrar(rs[1], ids[1], -300);
    expect((await eventos())[0].fin_en).toBeNull();
    await cerrar(rs[2], ids[2], -100);
    const [ev] = await eventos();
    expect(new Date(ev.fin_en).toISOString()).toBe(ctx.hace(-300)); // mediana de los tres cierres
  });

  it('una vez cerrado, un nuevo corte con N reportes abre otro evento', async () => {
    const rs = await vecinos(3);
    const ids: string[] = [];
    for (const [i, r] of rs.entries()) ids.push(await iniciar(r, 'electricidad', -100 + i));
    for (const [i, r] of rs.entries()) await cerrar(r, ids[i], -80 + i);
    expect((await eventos())[0].fin_en).not.toBeNull();

    for (const [i, r] of rs.entries()) await iniciar(r, 'electricidad', -20 + i);
    const evs = await eventos();
    expect(evs).toHaveLength(2);
    expect(evs[1].fin_en).toBeNull();
  });

  it('estado_sector no se reescribe si nada cambió (no dispara Realtime en vano)', async () => {
    const rs = await vecinos(4);
    for (const [i, r] of rs.slice(0, 3).entries()) await iniciar(r, 'electricidad', -10 - i);
    const antes = await estado(1, 'electricidad');

    // Con el corte ya confirmado, un cuarto reporte no cambia el estado.
    ctx.ahora = new Date(ctx.ahora.getTime() + 60_000);
    await iniciar(rs[3], 'electricidad', -5);
    const despues = await estado(1, 'electricidad');
    expect(new Date(despues.actualizado_en).getTime()).toBe(
      new Date(antes.actualizado_en).getTime(),
    );
  });
});
