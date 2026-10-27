import { CodigoError } from '@blackout/shared';
import { describe, expect, it, vi } from 'vitest';
import { cargarPuertosDemo } from '../datos/adaptadores/mock/cargar';
import { ID_REPORTE_ABIERTO_DEMO } from '../datos/adaptadores/mock/escenario';
import { textoAccion, textoBotonReportar } from '../dominio/aviso';
import { avisarCierre, avisarInicio } from './reportar';
import { crearSincronizador } from './sincronizar-cola';

const ids = (...lista: string[]) => {
  const pila = [...lista];
  return () => pila.shift() ?? 'sin-id';
};

describe('avisarInicio / avisarCierre', () => {
  it('REP-01: "Se fue la luz" entra a la cola como inicio de electricidad con la hora real', async () => {
    const p = await cargarPuertosDemo({ escenario: 'en-linea' });
    const aviso = await avisarInicio(
      { colaAvisos: p.colaAvisos, generarId: ids('r-luz') },
      { tipoServicio: 'electricidad', ocurridoEn: '2026-10-07T18:50:00Z' },
    );
    expect(aviso).toEqual({
      id: 'r-luz',
      reporteId: 'r-luz',
      tipoServicio: 'electricidad',
      accion: 'inicio',
      ocurridoEn: '2026-10-07T18:50:00Z',
      estado: 'pendiente',
    });
  });

  it('REP-02: "Se fue el agua" queda como agua, sin mezclarse con la luz', async () => {
    const p = await cargarPuertosDemo({ escenario: 'en-linea' });
    await avisarInicio(
      { colaAvisos: p.colaAvisos, generarId: ids('r-agua') },
      { tipoServicio: 'agua', ocurridoEn: '2026-10-07T18:00:00Z' },
    );
    expect((await p.colaAvisos.listar()).map((a) => a.tipoServicio)).toEqual(['agua']);
  });

  it('OFF-01: sin red el aviso queda pendiente en la cola y el envío fallido no rompe nada', async () => {
    const p = await cargarPuertosDemo({ escenario: 'sin-conexion' });
    const sincronizar = crearSincronizador(p);
    const aviso = await avisarInicio(
      { colaAvisos: p.colaAvisos, sincronizar, generarId: ids('r-sin-red') },
      { tipoServicio: 'agua', ocurridoEn: p.reloj.ahora() },
    );
    await sincronizar();
    const guardado = (await p.colaAvisos.listar()).find((a) => a.id === aviso.id);
    expect(guardado?.estado).toBe('pendiente');
  });

  it('pide el envío al encolar y con red el aviso sale de pendientes', async () => {
    const p = await cargarPuertosDemo({ escenario: 'en-linea' });
    const sincronizar = vi.fn(crearSincronizador(p));
    await avisarInicio(
      { colaAvisos: p.colaAvisos, sincronizar, generarId: ids('r-agua') },
      { tipoServicio: 'agua', ocurridoEn: p.reloj.ahora() },
    );
    expect(sincronizar).toHaveBeenCalledOnce();
    await sincronizar.mock.results[0]?.value;
    expect((await p.colaAvisos.listar())[0]?.estado).toBe('enviado');
    expect((await p.reportes.obtenerMios({ abiertos: true })).map((r) => r.id)).toContain('r-agua');
  });

  it('REP-03: "Ya volvió la luz" cierra el corte abierto con su mismo reporteId', async () => {
    const p = await cargarPuertosDemo({ escenario: 'en-linea' });
    const sincronizar = crearSincronizador(p);
    const [abierto] = await p.reportes.obtenerMios({ abiertos: true });
    if (!abierto) throw new Error('la demo trae un corte abierto');
    const cierre = await avisarCierre(
      { colaAvisos: p.colaAvisos, generarId: ids('aviso-cierre') },
      {
        abierto: { reporteId: abierto.id, inicioEn: abierto.inicioEn },
        tipoServicio: 'electricidad',
        ocurridoEn: p.reloj.ahora(),
      },
    );
    expect(cierre).toMatchObject({
      id: 'aviso-cierre',
      reporteId: ID_REPORTE_ABIERTO_DEMO,
      accion: 'cierre',
    });
    await sincronizar();
    expect(await p.reportes.obtenerMios({ abiertos: true })).toEqual([]);
  });

  it('OFF-05: el mismo aviso dos veces no duplica (agregar es idempotente por id)', async () => {
    const p = await cargarPuertosDemo({ escenario: 'en-linea' });
    const deps = { colaAvisos: p.colaAvisos, generarId: ids('r1', 'r1') };
    const datos = { tipoServicio: 'agua' as const, ocurridoEn: '2026-10-07T18:00:00Z' };
    await avisarInicio(deps, datos);
    await avisarInicio(deps, datos);
    expect(await p.colaAvisos.listar()).toHaveLength(1);
  });

  it('REP-05: un segundo inicio del mismo servicio termina en error permanente con su código', async () => {
    const p = await cargarPuertosDemo({ escenario: 'en-linea' });
    const sincronizar = crearSincronizador(p);
    // La demo ya tiene un corte de luz abierto: otro inicio de luz choca (409).
    await avisarInicio(
      { colaAvisos: p.colaAvisos, generarId: ids('otro') },
      { tipoServicio: 'electricidad', ocurridoEn: p.reloj.ahora() },
    );
    await sincronizar();
    expect((await p.colaAvisos.listar())[0]).toMatchObject({
      estado: 'error',
      codigoError: CodigoError.ReporteAbiertoDuplicado,
    });
  });
});

describe('textos de los avisos', () => {
  it('fila de la cola y botón principal (CANON §7.1)', () => {
    expect(textoAccion('inicio', 'electricidad')).toBe('Se fue la luz');
    expect(textoAccion('cierre', 'agua')).toBe('Volvió el agua');
    expect(textoBotonReportar(false, 'agua')).toBe('Se fue el agua');
    expect(textoBotonReportar(true, 'electricidad')).toBe('Ya volvió la luz');
  });
});
