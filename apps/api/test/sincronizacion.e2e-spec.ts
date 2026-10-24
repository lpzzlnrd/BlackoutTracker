import { randomUUID } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import type { AddressInfo } from 'node:net';
import { AccionCola, accionDeRespuesta, type OperacionCola } from '@blackout/shared';
import { Contexto, type ResidentePrueba } from './contexto';

/** Un envío de la cola offline del cliente: lo que Dexie guardaría. */
interface Envio {
  operacion: OperacionCola;
  id: string;
  cuerpo: { tipoServicio?: string; ocurridoEn: string };
}

describe('contrato de sincronización de la cola offline (T-040)', () => {
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

  const cuenta = async (id: string) => {
    const [f] = await ctx.bd.sql`select count(*)::int as n from reportes where id = ${id}`;
    return f.n as number;
  };

  const enviar = (e: Envio, r: ResidentePrueba) =>
    e.operacion === 'inicio'
      ? ctx.put(e.id, r.token, e.cuerpo)
      : ctx.patch(e.id, r.token, e.cuerpo);

  /**
   * Vacía la cola como lo hará el cliente: respeta el orden, y un envío que se debe reintentar
   * pasa al final (un cierre cuyo inicio aún no llega). Devuelve los estados HTTP en el orden en
   * que ocurrieron.
   */
  const drenar = async (cola: Envio[], r: ResidentePrueba): Promise<number[]> => {
    const pendientes = [...cola];
    const estados: number[] = [];
    for (let vueltas = 0; pendientes.length > 0; vueltas++) {
      expect(vueltas).toBeLessThan(10); // si no avanza, el contrato está roto
      const envio = pendientes.shift() as Envio;
      const { status } = await enviar(envio, r);
      estados.push(status);
      const accion = accionDeRespuesta(status, envio.operacion);
      if (accion === AccionCola.Reintentar) pendientes.push(envio);
      else expect(accion).toBe(AccionCola.Exito);
    }
    return estados;
  };

  it('OFF-04: inicio y cierre enviados en orden → el ciclo queda completo con las horas del evento', async () => {
    const r = await ctx.residente();
    const id = randomUUID();
    const estados = await drenar(
      [
        {
          operacion: 'inicio',
          id,
          cuerpo: { tipoServicio: 'electricidad', ocurridoEn: ctx.hace(-180) },
        },
        { operacion: 'cierre', id, cuerpo: { ocurridoEn: ctx.hace(-60) } },
      ],
      r,
    );
    expect(estados).toEqual([200, 200]);
    const f = await fila(id);
    // OFF-03: se guardan las horas del evento, no las del envío.
    expect(new Date(f.inicio_en as string).toISOString()).toBe(ctx.hace(-180));
    expect(new Date(f.fin_en as string).toISOString()).toBe(ctx.hace(-60));
    const [mio] = (await ctx.get('/api/reportes/mios', r.token).expect(200)).body;
    expect(mio).toMatchObject({ id, duracionMin: 120 });
  });

  it('OFF-04: el cierre llega antes que el inicio → 404, se reintenta y tras el inicio da 200', async () => {
    const r = await ctx.residente();
    const id = randomUUID();
    const cierre: Envio = { operacion: 'cierre', id, cuerpo: { ocurridoEn: ctx.hace(-30) } };

    const antes = await enviar(cierre, r).expect(404);
    expect(antes.body.codigo).toBe('REPORTE_NO_ENCONTRADO');
    expect(accionDeRespuesta(antes.status, 'cierre')).toBe(AccionCola.Reintentar);
    expect(await cuenta(id)).toBe(0); // el cierre huérfano no deja nada

    const inicio = await ctx
      .put(id, r.token, { tipoServicio: 'agua', ocurridoEn: ctx.hace(-120) })
      .expect(200);
    expect(accionDeRespuesta(inicio.status, 'inicio')).toBe(AccionCola.Exito);

    const despues = await enviar(cierre, r).expect(200);
    expect(accionDeRespuesta(despues.status, 'cierre')).toBe(AccionCola.Exito);
    expect(despues.body).toMatchObject({ id, duracionMin: 90 });
  });

  it('OFF-04: una cola con el cierre por delante del inicio se vacía sola y el ciclo queda completo', async () => {
    const r = await ctx.residente();
    const id = randomUUID();
    const estados = await drenar(
      [
        { operacion: 'cierre', id, cuerpo: { ocurridoEn: ctx.hace(-30) } },
        { operacion: 'inicio', id, cuerpo: { tipoServicio: 'agua', ocurridoEn: ctx.hace(-120) } },
      ],
      r,
    );
    expect(estados).toEqual([404, 200, 200]);
    expect((await fila(id)).fin_en).not.toBeNull();
  });

  it('OFF-04: ciclos de agua y luz en la misma cola no se mezclan', async () => {
    const r = await ctx.residente();
    const luz = randomUUID();
    const agua = randomUUID();
    await drenar(
      [
        {
          operacion: 'inicio',
          id: luz,
          cuerpo: { tipoServicio: 'electricidad', ocurridoEn: ctx.hace(-240) },
        },
        {
          operacion: 'inicio',
          id: agua,
          cuerpo: { tipoServicio: 'agua', ocurridoEn: ctx.hace(-200) },
        },
        { operacion: 'cierre', id: luz, cuerpo: { ocurridoEn: ctx.hace(-180) } },
        { operacion: 'cierre', id: agua, cuerpo: { ocurridoEn: ctx.hace(-20) } },
      ],
      r,
    );
    const [l, a] = [await fila(luz), await fila(agua)];
    expect([l.tipo_servicio, a.tipo_servicio]).toEqual(['electricidad', 'agua']);
    expect([l.fin_en, a.fin_en]).not.toContain(null);
  });

  describe('OFF-05: la petición llega a la base pero el cliente no recibe la respuesta', () => {
    let puerto: number;

    beforeAll(async () => {
      await ctx.app.listen(0, '127.0.0.1');
      puerto = (ctx.app.getHttpServer().address() as AddressInfo).port;
    });

    /**
     * Manda la petición por un socket real y lo corta en cuanto el cambio está en la base, sin leer
     * la respuesta: es lo que ve el cliente cuando se cae la red a mitad del envío.
     */
    const enviarYCortar = async (
      metodo: 'PUT' | 'PATCH',
      ruta: string,
      token: string,
      cuerpo: object,
      yaEnBase: () => Promise<boolean>,
    ): Promise<void> => {
      const texto = JSON.stringify(cuerpo);
      const peticion = httpRequest({
        host: '127.0.0.1',
        port: puerto,
        method: metodo,
        path: ruta,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(texto),
          Authorization: `Bearer ${token}`,
          'X-Forwarded-For': '10.9.9.9',
        },
      });
      peticion.on('error', () => undefined); // el corte lo provocamos nosotros
      peticion.end(texto);
      for (let i = 0; i < 150 && !(await yaEnBase()); i++) {
        await new Promise((resolver) => setTimeout(resolver, 20));
      }
      peticion.destroy();
      expect(await yaEnBase()).toBe(true);
    };

    it('inicio: el reintento da 200 y el reporte existe una sola vez', async () => {
      const r = await ctx.residente();
      const id = randomUUID();
      const cuerpo = { tipoServicio: 'agua', ocurridoEn: ctx.hace(-45) };
      await enviarYCortar(
        'PUT',
        `/api/reportes/${id}`,
        r.token,
        cuerpo,
        async () => (await cuenta(id)) === 1,
      );

      const reintento = await ctx.put(id, r.token, cuerpo).expect(200);
      expect(accionDeRespuesta(reintento.status, 'inicio')).toBe(AccionCola.Exito);
      expect(reintento.body).toMatchObject({ id, inicioEn: cuerpo.ocurridoEn, finEn: null });
      expect(await cuenta(id)).toBe(1);
    });

    it('cierre: el reintento da 200 con la misma duración y no cambia el fin', async () => {
      const r = await ctx.residente();
      const id = randomUUID();
      await ctx
        .put(id, r.token, { tipoServicio: 'electricidad', ocurridoEn: ctx.hace(-120) })
        .expect(200);
      const cuerpo = { ocurridoEn: ctx.hace(-30) };
      await enviarYCortar('PATCH', `/api/reportes/${id}/cierre`, r.token, cuerpo, async () => {
        return (await fila(id)).fin_en !== null;
      });
      const recibidoEn = (await fila(id)).cerrado_recibido_en as Date;

      const reintento = await ctx.patch(id, r.token, cuerpo).expect(200);
      expect(accionDeRespuesta(reintento.status, 'cierre')).toBe(AccionCola.Exito);
      expect(reintento.body).toMatchObject({ id, finEn: cuerpo.ocurridoEn, duracionMin: 90 });
      expect((await fila(id)).cerrado_recibido_en).toEqual(recibidoEn);
    });
  });

  it('las respuestas reales de la API caen en la acción que fija la tabla', async () => {
    const r = await ctx.residente();
    const id = randomUUID();
    const inicio = { tipoServicio: 'agua', ocurridoEn: ctx.hace(-60) };
    await ctx.put(id, r.token, inicio).expect(200);

    const casos: Array<[string, OperacionCola, number, AccionCola]> = [
      [
        '400 cuerpo inválido',
        'inicio',
        (await ctx.put(randomUUID(), r.token, {})).status,
        AccionCola.ErrorPermanente,
      ],
      [
        '401 sin token',
        'inicio',
        (await ctx.put(randomUUID(), undefined, inicio)).status,
        AccionCola.RefrescarSesion,
      ],
      [
        '409 reporte abierto duplicado',
        'inicio',
        (await ctx.put(randomUUID(), r.token, inicio)).status,
        AccionCola.ErrorPermanente,
      ],
      [
        '409 mismo id, otro contenido',
        'inicio',
        (await ctx.put(id, r.token, { ...inicio, tipoServicio: 'electricidad' })).status,
        AccionCola.ErrorPermanente,
      ],
      [
        '422 hora en el futuro',
        'inicio',
        (
          await ctx.put(randomUUID(), r.token, {
            tipoServicio: 'electricidad',
            ocurridoEn: ctx.hace(30),
          })
        ).status,
        AccionCola.ErrorPermanente,
      ],
      [
        '422 fin antes del inicio',
        'cierre',
        (await ctx.patch(id, r.token, { ocurridoEn: ctx.hace(-90) })).status,
        AccionCola.ErrorPermanente,
      ],
      [
        '404 cierre sin inicio',
        'cierre',
        (await ctx.patch(randomUUID(), r.token, { ocurridoEn: ctx.hace(-5) })).status,
        AccionCola.Reintentar,
      ],
    ];
    for (const [nombre, operacion, estado, esperada] of casos) {
      expect([nombre, accionDeRespuesta(estado, operacion)]).toEqual([nombre, esperada]);
    }
    expect(casos.map(([, , estado]) => estado)).toEqual([400, 401, 409, 409, 422, 422, 404]);
  });
});
