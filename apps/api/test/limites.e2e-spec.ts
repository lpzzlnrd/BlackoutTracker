import { randomUUID } from 'node:crypto';
import { Contexto } from './contexto';

// El throttle con sesión cuenta por residente y no por IP (D-044): los vecinos que comparten IP
// (CGNAT, el Wi-Fi de una prueba de campo) no se frenan entre ellos, y una cola offline normal se
// vacía de un golpe sin ningún 429 (OFF-04).

describe('límites por residente (T-051, D-044)', () => {
  let ctx: Contexto;

  beforeAll(async () => {
    ctx = await Contexto.crear();
  });
  afterAll(() => ctx.cerrar());
  beforeEach(() => ctx.reiniciar());

  it('OFF-04: vaciar una cola de 20 avisos (20 inicios y 20 cierres) seguidos no da ningún 429', async () => {
    const { token } = await ctx.residente(1);
    const estados: number[] = [];
    for (let i = 0; i < 20; i++) {
      const id = randomUUID();
      const inicio = ctx.hace(-600 + i * 20);
      const fin = ctx.hace(-590 + i * 20);
      estados.push((await ctx.put(id, token, { tipoServicio: 'agua', ocurridoEn: inicio })).status);
      estados.push((await ctx.patch(id, token, { ocurridoEn: fin })).status);
    }
    expect(estados.filter((e) => e !== 200)).toEqual([]);
  });

  it('D-044: con la misma IP, el residente que se pasa recibe 429 y otro vecino sigue escribiendo', async () => {
    const fija = '198.51.100.7';
    const a = await ctx.residente(1);
    const b = await ctx.residente(1);
    const id = randomUUID();
    const cuerpo = { tipoServicio: 'electricidad', ocurridoEn: ctx.hace(-5) };
    const enviar = (token: string, reporte = id) =>
      ctx.put(reporte, token, cuerpo).set('X-Forwarded-For', fija);

    // El reintento idempotente también cuenta: 60 pasan y el 61 se frena.
    for (let i = 0; i < 60; i++) expect((await enviar(a.token)).status).toBe(200);
    const frenado = await enviar(a.token);
    expect(frenado.status).toBe(429);
    expect(frenado.body.codigo).toBe('DEMASIADAS_SOLICITUDES');

    expect((await enviar(b.token, randomUUID())).status).toBe(200);
  });
});
