import { describe, expect, it } from 'vitest';
import { crearColaAvisosMock } from '../datos/adaptadores/mock/cola-avisos.mock';
import { crearConexionMock } from '../datos/adaptadores/mock/conexion.mock';
import {
  crearPushMock,
  crearRepositorioNotificacionesMock,
} from '../datos/adaptadores/mock/notificaciones.mock';
import { crearRelojMock } from '../datos/adaptadores/mock/reloj.mock';
import { crearSesionMock } from '../datos/adaptadores/mock/sesion.mock';
import type { Sesion } from '../datos/puertos';
import { cerrarSesion } from './cerrar-sesion';
import { activarNotificaciones } from './notificaciones';

const aviso = {
  id: 'a1',
  reporteId: 'r1',
  tipoServicio: 'electricidad' as const,
  accion: 'inicio' as const,
  ocurridoEn: '2026-10-07T18:00:00Z',
};

describe('cerrarSesion', () => {
  it('REG-07: cierra la sesión y vacía la cola del residente', async () => {
    const sesion = crearSesionMock();
    const colaAvisos = crearColaAvisosMock();
    await colaAvisos.agregar(aviso);

    await cerrarSesion({ sesion, colaAvisos });

    expect(sesion.leer()).toBeNull();
    expect(await colaAvisos.listar()).toEqual([]);
  });

  it('REG-07, NOT-19: da de baja las notificaciones de este dispositivo antes de cerrar la sesión', async () => {
    const sesion = crearSesionMock();
    const colaAvisos = crearColaAvisosMock();
    const notificaciones = crearRepositorioNotificacionesMock({
      reloj: crearRelojMock('2026-11-03T18:00:00Z'),
      conexion: crearConexionMock({ modo: 'en-linea', ultimaSincronizacion: null }),
      latenciaMs: 0,
    });
    const push = crearPushMock();
    await activarNotificaciones({ notificaciones, push });
    let teniaSesionAlDarDeBaja = false;
    const espia = {
      ...notificaciones,
      darDeBaja: async (s: { endpoint: string }) => {
        teniaSesionAlDarDeBaja = sesion.leer() !== null;
        await notificaciones.darDeBaja(s);
      },
    };

    await cerrarSesion({ sesion, colaAvisos, notificaciones: espia, push });

    expect(teniaSesionAlDarDeBaja).toBe(true);
    expect(notificaciones.suscripciones()).toEqual([]);
    expect(await push.actual()).toBeNull();
    expect(sesion.leer()).toBeNull();
  });

  it('REG-07, NOT-19: si la baja de las notificaciones falla, la sesión se cierra igual', async () => {
    const sesion = crearSesionMock();
    const colaAvisos = crearColaAvisosMock();
    const push = crearPushMock();
    const fallaTodo = {
      ...crearRepositorioNotificacionesMock({
        reloj: crearRelojMock('2026-11-03T18:00:00Z'),
        conexion: crearConexionMock({ modo: 'en-linea', ultimaSincronizacion: null }),
        latenciaMs: 0,
      }),
      darDeBaja: () => Promise.reject(new Error('sin red')),
    };
    await push.suscribir('clave');
    const roto = { ...push, anular: () => Promise.reject(new Error('sin SW')) };

    await cerrarSesion({ sesion, colaAvisos, notificaciones: fallaTodo, push: roto });

    expect(sesion.leer()).toBeNull();
  });

  it('REG-07: si cerrar la sesión falla, la cola queda intacta', async () => {
    const sesion: Sesion = {
      ...crearSesionMock(),
      cerrar: () => Promise.reject(new Error('sin red')),
    };
    const colaAvisos = crearColaAvisosMock();
    await colaAvisos.agregar(aviso);

    await expect(cerrarSesion({ sesion, colaAvisos })).rejects.toThrow('sin red');
    expect(await colaAvisos.listar()).toHaveLength(1);
  });
});
