import { randomUUID } from 'node:crypto';
import { ConsensoCron } from '../src/consenso/consenso.cron';
import { ConsensoService } from '../src/consenso/consenso.service';
import { Contexto, type ResidentePrueba } from './contexto';

const HORA_MS = 3_600_000;

describe('Ciclos incompletos: reportes vencidos (T-050, D-015)', () => {
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
  const reporte = async (id: string) => {
    const [fila] = await ctx.bd.sql`select * from reportes where id = ${id}`;
    return fila;
  };
  const adelantar = (horas: number) => {
    ctx.ahora = new Date(ctx.ahora.getTime() + horas * HORA_MS);
  };
  const barrer = () => ctx.app.get(ConsensoCron).ejecutar();

  const vecinos = (n: number, sectorId = 1): Promise<ResidentePrueba[]> =>
    Promise.all(Array.from({ length: n }, () => ctx.residente(sectorId)));
  const iniciar = async (r: ResidentePrueba, tipo: string, minutos: number): Promise<string> => {
    const id = randomUUID();
    await ctx.put(id, r.token, { tipoServicio: tipo, ocurridoEn: ctx.hace(minutos) }).expect(200);
    return id;
  };

  it('T-050: el borde exacto de REPORTE_VENCE_HORAS (48 h) todavía cuenta; un milisegundo más, vence', async () => {
    const [a] = await vecinos(1);
    const id = await iniciar(a, 'agua', 0);
    const inicio = ctx.ahora.getTime();

    ctx.ahora = new Date(inicio + 48 * HORA_MS);
    await barrer();
    expect((await reporte(id)).vencido).toBe(false);

    ctx.ahora = new Date(inicio + 48 * HORA_MS + 1);
    await barrer();
    expect((await reporte(id)).vencido).toBe(true);
  });

  it('REP-05: tras vencer, el residente puede abrir otro reporte del mismo servicio', async () => {
    const [a] = await vecinos(1);
    const viejo = await iniciar(a, 'agua', 0);
    // Antes de vencer, REP-05 sigue bloqueando.
    await ctx
      .put(randomUUID(), a.token, { tipoServicio: 'agua', ocurridoEn: ctx.hace(1) })
      .expect(409);

    adelantar(49);
    await barrer();
    expect((await reporte(viejo)).vencido).toBe(true);

    const nuevo = randomUUID();
    await ctx.put(nuevo, a.token, { tipoServicio: 'agua', ocurridoEn: ctx.hace(-1) }).expect(200);
    expect((await reporte(nuevo)).vencido).toBe(false);
    // Y el nuevo vuelve a bloquear (REP-05 sigue vigente para los reportes vivos).
    await ctx
      .put(randomUUID(), a.token, { tipoServicio: 'agua', ocurridoEn: ctx.hace(-1) })
      .expect(409);
  });

  it('CON-06: el evento se cierra cuando los reportes abiertos que quedaban vencen', async () => {
    const [a, b, c] = await vecinos(3);
    const ra = await iniciar(a, 'electricidad', -20);
    await iniciar(b, 'electricidad', -15);
    await iniciar(c, 'electricidad', -10);
    expect(await eventos()).toHaveLength(1);

    // Solo a avisa de que volvió la luz: b y c siguen abiertos, el evento sigue.
    const cierre = ctx.hace(-5);
    await ctx.patch(ra, a.token, { ocurridoEn: cierre }).expect(200);
    expect((await eventos())[0].fin_en).toBeNull();

    // b y c no dicen nada más: a las 48 h vencen y ya no quedan reportes vivos.
    adelantar(49);
    await barrer();

    const [evento] = await eventos();
    expect(new Date(evento.fin_en).toISOString()).toBe(cierre);
    expect(await estado(1, 'electricidad')).toMatchObject({
      estado: 'con_servicio',
      reportes_sin_confirmar: 0,
      evento_id: null,
    });
  });

  it('T-050: si todos los reportes vencen sin ningún cierre, el evento termina incompleto y sin fin', async () => {
    const [a, b, c] = await vecinos(3);
    await iniciar(a, 'electricidad', -20);
    await iniciar(b, 'electricidad', -15);
    await iniciar(c, 'electricidad', -10);

    adelantar(49);
    await barrer();

    // Los tres vencieron y nadie dijo que volvió el servicio: no se inventa un fin.
    const vencidos = await ctx.bd.sql`select 1 from reportes where vencido`;
    expect(vencidos).toHaveLength(3);
    const [evento] = await eventos();
    expect(evento).toMatchObject({ incompleto: true, fin_en: null });
    expect(evento.restablecido_en).not.toBeNull();
    expect(await estado(1, 'electricidad')).toMatchObject({
      estado: 'con_servicio',
      reportes_sin_confirmar: 0,
      evento_id: null,
      desde: null,
    });
  });

  it('EST-06: un ciclo incompleto no entra en el universo de la estimación (eventos con fin)', async () => {
    const [a, b, c] = await vecinos(3);
    await iniciar(a, 'agua', -20);
    await iniciar(b, 'agua', -15);
    await iniciar(c, 'agua', -10);
    adelantar(49);
    await barrer();

    const universo = await ctx.bd.sql`
      select 1 from eventos_sector where sector_id = 1 and tipo_servicio = 'agua' and fin_en is not null`;
    expect(universo).toHaveLength(0);
  });

  it('T-050: tras un ciclo incompleto, el corte siguiente abre un evento nuevo con su propia duración', async () => {
    const [a, b, c] = await vecinos(3);
    await iniciar(a, 'agua', -20);
    await iniciar(b, 'agua', -15);
    await iniciar(c, 'agua', -10);
    adelantar(49);
    await barrer();

    // Días después, otro corte: los mismos vecinos (sus reportes viejos vencieron) reportan y cierran.
    adelantar(72);
    const nuevos = [
      await iniciar(a, 'agua', -30),
      await iniciar(b, 'agua', -25),
      await iniciar(c, 'agua', -20),
    ];
    const [, segundo] = await eventos();
    expect(segundo).toMatchObject({ incompleto: false, fin_en: null });
    expect(new Date(segundo.inicio_en).toISOString()).toBe(ctx.hace(-25));

    const fin = ctx.hace(-5);
    for (const [i, r] of [a, b, c].entries()) {
      await ctx.patch(nuevos[i], r.token, { ocurridoEn: fin }).expect(200);
    }
    const todos = await eventos();
    expect(todos).toHaveLength(2);
    expect(todos[0]).toMatchObject({ incompleto: true, fin_en: null });
    // La duración del segundo es la suya (20 min), no la de los dos cortes sumados.
    const minutos =
      (new Date(todos[1].fin_en).getTime() - new Date(todos[1].inicio_en).getTime()) / 60_000;
    expect(minutos).toBe(20);
  });

  it('T-050: cerrar tarde un reporte vencido (cola offline) no reabre ni modifica el ciclo incompleto', async () => {
    const [a, b, c] = await vecinos(3);
    const ra = await iniciar(a, 'electricidad', -20);
    await iniciar(b, 'electricidad', -15);
    await iniciar(c, 'electricidad', -10);
    adelantar(49);
    await barrer();
    const [antes] = await eventos();

    await ctx.patch(ra, a.token, { ocurridoEn: ctx.hace(-48 * 60) }).expect(200);
    await barrer();

    expect(await eventos()).toEqual([antes]);
    expect((await estado(1, 'electricidad')).estado).toBe('con_servicio');
  });

  it('T-050: un reporte vencido no suma a un consenso nuevo', async () => {
    const [a, b, c] = await vecinos(3);
    // a y b reportan y pasan 49 h sin cierre: vencen. Cuando llega c, está solo: 1 sin confirmar y
    // ningún evento, aunque en total haya tres reportes del mismo par.
    await iniciar(a, 'agua', -30);
    await iniciar(b, 'agua', -29);
    adelantar(49);
    await iniciar(c, 'agua', -1);
    await barrer();

    expect(await eventos()).toHaveLength(0);
    expect(await estado(1, 'agua')).toMatchObject({
      estado: 'con_servicio',
      reportes_sin_confirmar: 1,
    });
  });

  it('T-050: cerrar un reporte vencido se acepta (es evidencia de que volvió el servicio) y sigue marcado vencido', async () => {
    const [a] = await vecinos(1);
    const id = await iniciar(a, 'agua', 0);
    adelantar(50);
    await barrer();
    expect((await reporte(id)).vencido).toBe(true);

    const res = await ctx.patch(id, a.token, { ocurridoEn: ctx.hace(-60) }).expect(200);
    expect(res.body.finEn).not.toBeNull();
    expect(res.body.duracionMin).toBe(50 * 60 - 60);
    const fila = await reporte(id);
    expect(fila.vencido).toBe(true);
    expect(fila.fin_en).not.toBeNull();
  });

  it('T-050: GET /reportes/mios?abiertos=true no incluye los vencidos; sin filtro sí', async () => {
    const [a] = await vecinos(1);
    const viejo = await iniciar(a, 'agua', 0);
    adelantar(49);
    await barrer();
    const vivo = randomUUID();
    await ctx.put(vivo, a.token, { tipoServicio: 'agua', ocurridoEn: ctx.hace(-5) }).expect(200);

    const abiertos = await ctx.get('/api/reportes/mios?abiertos=true', a.token).expect(200);
    expect(abiertos.body.map((r: { id: string }) => r.id)).toEqual([vivo]);
    const todos = await ctx.get('/api/reportes/mios', a.token).expect(200);
    expect(todos.body.map((r: { id: string }) => r.id).sort()).toEqual([viejo, vivo].sort());
  });

  it('T-050: el cron es idempotente (la segunda pasada no marca ni cambia nada)', async () => {
    const [a, b, c] = await vecinos(3);
    await iniciar(a, 'electricidad', -20);
    await iniciar(b, 'electricidad', -15);
    await iniciar(c, 'electricidad', -10);
    adelantar(49);

    const servicio = ctx.app.get(ConsensoService);
    expect(await servicio.vencerReportes()).toEqual([
      { sectorId: 1, tipoServicio: 'electricidad' },
    ]);
    await barrer();
    const antes = await estado(1, 'electricidad');
    await barrer();
    expect(await servicio.vencerReportes()).toEqual([]);
    expect(await estado(1, 'electricidad')).toEqual(antes);
  });

  it('T-050: con el cron apagado (CRON_ACTIVO=false) el tic no hace nada, pero se puede invocar directo', async () => {
    const [a] = await vecinos(1);
    const id = await iniciar(a, 'agua', 0);
    adelantar(49);

    await ctx.app.get(ConsensoCron).alMinuto();
    expect((await reporte(id)).vencido).toBe(false);

    await ctx.app.get(ConsensoCron).ejecutar();
    expect((await reporte(id)).vencido).toBe(true);
  });

  it('CON-07: leer un par recalcula el vencimiento sin depender del cron (refrescarSiViejo)', async () => {
    const [a, b, c] = await vecinos(3);
    const ra = await iniciar(a, 'electricidad', -20);
    await iniciar(b, 'electricidad', -15);
    await iniciar(c, 'electricidad', -10);
    await ctx.patch(ra, a.token, { ocurridoEn: ctx.hace(-5) }).expect(200);
    adelantar(49);

    await ctx.app.get(ConsensoService).refrescarSiViejo(1, 'electricidad');

    expect((await eventos())[0].fin_en).not.toBeNull();
    expect((await estado(1, 'electricidad')).estado).toBe('con_servicio');
  });

  it('T-050: el vencimiento es por sector y servicio (no toca otros pares ni reportes recientes)', async () => {
    const [a] = await vecinos(1, 1);
    const [b] = await vecinos(1, 2);
    const viejoAgua = await iniciar(a, 'agua', 0);
    const viejoLuz = await iniciar(a, 'electricidad', 0);
    adelantar(47);
    const reciente = await iniciar(b, 'agua', 0);
    adelantar(2);
    await barrer();

    expect((await reporte(viejoAgua)).vencido).toBe(true);
    expect((await reporte(viejoLuz)).vencido).toBe(true);
    expect((await reporte(reciente)).vencido).toBe(false);
  });
});
