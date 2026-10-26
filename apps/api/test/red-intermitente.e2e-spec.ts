import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { Logger } from '@nestjs/common';
import { ProxyIntermitente } from '../scripts/red-intermitente/proxy';
import { simular } from '../scripts/red-intermitente/simulacion';
import { resumirVerificacion, verificar } from '../scripts/red-intermitente/verificacion';
import { Contexto } from './contexto';

// Versión corta de NF-04 (T-054). La larga (10 min) es `pnpm --filter api red:intermitente`.
const DURACION_MS = Number(process.env.RED_DURACION_S ?? 25) * 1000;

describe('Red intermitente (T-054)', () => {
  let ctx: Contexto;
  let urlApi: string;

  beforeAll(async () => {
    ctx = await Contexto.crear();
    await ctx.app.listen(0, '127.0.0.1');
    const { port } = ctx.app.getHttpServer().address() as AddressInfo;
    urlApi = `http://127.0.0.1:${port}`;
  });
  afterAll(() => ctx.cerrar());
  beforeEach(() => ctx.reiniciar());

  it(
    'NF-04 / OFF-05: con la red cortándose al azar, 0 pérdidas, 0 duplicados y la hora del evento intacta',
    async () => {
      // Dos residentes por sector en los 4 sectores provisionales, con agua y luz.
      // Un cuerpo cortado a la mitad (`corta-envio`) llega al filtro como `request aborted` y se
      // registra; cualquier otro error registrado sería un 500 de verdad y hace fallar la prueba.
      const errores: unknown[] = [];
      const log = jest.spyOn(Logger.prototype, 'error').mockImplementation((e: unknown) => {
        if ((e as { type?: string })?.type !== 'request.aborted') errores.push(e);
      });
      const residentes = await Promise.all([1, 1, 2, 2, 3, 3, 4, 4].map((s) => ctx.residente(s)));
      const proxy = new ProxyIntermitente({
        destino: urlApi,
        probCortaAntes: 0.12,
        probCortaEnvio: 0.08,
        probCortaDespues: 0.15,
        probLenta: 0.1,
        latenciaMaxMs: 2500,
        caidas: { cadaMs: [2000, 5000], duracionMs: [300, 1500] },
      });
      await proxy.abrir();

      const r = await simular({
        urlApi: `${proxy.url}/api`,
        residentes,
        duracionMs: DURACION_MS,
        ahora: () => ctx.ahora,
        pausaMs: [20, 150],
        esperaReintentoMs: [20, 200],
        timeoutMs: 1500,
        probReenvio: 0.15,
        // La API de los tests confía en X-Forwarded-For: así el throttle por IP no frena la prueba.
        ipPorPeticion: true,
        antesDeDrenar: () => proxy.calmar(),
      });
      await proxy.cerrar();
      log.mockRestore();

      const v = await verificar(
        ctx.bd.sql,
        r.esperados,
        residentes.map((x) => x.id),
      );
      console.log(
        `NF-04 (${DURACION_MS / 1000} s): ${resumirVerificacion(v)}\n` +
          `  cliente: ${JSON.stringify({ ...r, esperados: r.esperados.length })}\n` +
          `  red: ${JSON.stringify(proxy.estadisticas)}`,
      );

      expect(errores).toEqual([]);
      expect(r.inesperados).toEqual([]);
      expect(v.perdidos).toEqual([]);
      expect(v.duplicados).toEqual([]);
      expect(v.diferencias).toEqual([]);
      expect(v.enBd).toBe(r.esperados.length);
      // La prueba solo vale si la red de verdad falló, también después de que la API guardó.
      expect(r.esperados.length).toBeGreaterThanOrEqual(20);
      expect(r.reintentos).toBeGreaterThan(0);
      expect(r.reenvios).toBeGreaterThan(0);
      expect(proxy.estadisticas.cortadasDespues).toBeGreaterThan(0);
      expect(proxy.estadisticas.cortadasAntes).toBeGreaterThan(0);
    },
    DURACION_MS + 60_000,
  );

  it('NF-04: la verificación detecta una pérdida, un duplicado y una hora cambiada', async () => {
    const r = await ctx.residente();
    const guardado = { id: randomUUID(), inicio: ctx.hace(-60) };
    await ctx
      .put(guardado.id, r.token, { tipoServicio: 'agua', ocurridoEn: guardado.inicio })
      .expect(200);
    // El mismo evento guardado otra vez con otro id (lo que haría un cliente sin idempotencia).
    const repetido = randomUUID();
    await ctx.bd.sql`
      insert into reportes (id, residente_id, sector_id, tipo_servicio, inicio_en, fin_en)
      values (${repetido}, ${r.id}, ${r.sectorId}, 'agua', ${guardado.inicio}, ${ctx.hace(-30)})`;
    const perdido = randomUUID();

    const v = await verificar(
      ctx.bd.sql,
      [
        {
          id: guardado.id,
          residenteId: r.id,
          tipoServicio: 'agua',
          inicioEn: ctx.hace(-61),
          finEn: null,
        },
        {
          id: perdido,
          residenteId: r.id,
          tipoServicio: 'electricidad',
          inicioEn: ctx.hace(-5),
          finEn: null,
        },
      ],
      [r.id],
    );
    expect(v.perdidos).toEqual([perdido]);
    expect(v.duplicados).toEqual([repetido]);
    expect(v.diferencias).toEqual([
      { id: guardado.id, campo: 'inicioEn', esperado: ctx.hace(-61), real: guardado.inicio },
    ]);

    // Con los ids previos excluidos (una base que no se vació), no cuentan.
    const limpio = await verificar(ctx.bd.sql, [], [r.id], new Set([guardado.id, repetido]));
    expect(limpio).toMatchObject({ perdidos: [], duplicados: [], diferencias: [], enBd: 0 });
  });
});
