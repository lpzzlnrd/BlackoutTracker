import { describe, expect, it } from 'vitest';
import { crearConexionMock } from '../datos/adaptadores/mock/conexion.mock';
import {
  crearPushMock,
  crearRepositorioNotificacionesMock,
} from '../datos/adaptadores/mock/notificaciones.mock';
import { crearRelojMock } from '../datos/adaptadores/mock/reloj.mock';
import type { PushDispositivo } from '../datos/puertos';
import {
  CLAVE_SINCRONIZADA,
  activarNotificaciones,
  debeOfrecerNotificaciones,
  desactivarNotificaciones,
  guardarDescarteOferta,
  leerDescarteOferta,
  sincronizarSuscripcion,
} from './notificaciones';

const AHORA = '2026-11-03T23:00:00.000Z';

function entorno(modo: 'en-linea' | 'sin-conexion' = 'en-linea') {
  return {
    reloj: crearRelojMock(AHORA),
    conexion: crearConexionMock({ modo, ultimaSincronizacion: null }),
    latenciaMs: 0,
  };
}

/** `localStorage` de mentira. */
function almacen() {
  const datos = new Map<string, string>();
  return {
    getItem: (k: string) => datos.get(k) ?? null,
    setItem: (k: string, v: string) => void datos.set(k, v),
    removeItem: (k: string) => void datos.delete(k),
  };
}

describe('activarNotificaciones (T-072)', () => {
  it('NOT-19: pide el permiso, suscribe el navegador y lo da de alta en la API', async () => {
    const notificaciones = crearRepositorioNotificacionesMock(entorno());
    const push = crearPushMock();
    expect(await activarNotificaciones({ notificaciones, push })).toBe('activadas');
    expect(push.estado()).toBe('concedido');
    expect(notificaciones.suscripciones()).toHaveLength(1);
  });

  it('NOT-18: sin claves en el servidor no pide un permiso que no se va a usar', async () => {
    const notificaciones = crearRepositorioNotificacionesMock(entorno(), { activo: false });
    const push = crearPushMock();
    expect(await activarNotificaciones({ notificaciones, push })).toBe('inactivo');
    expect(push.estado()).toBe('pendiente');
  });

  it('NOT-18: si el vecino no da el permiso, no se da de alta nada', async () => {
    const notificaciones = crearRepositorioNotificacionesMock(entorno());
    const push = crearPushMock({ concede: false });
    expect(await activarNotificaciones({ notificaciones, push })).toBe('denegado');
    expect(notificaciones.suscripciones()).toEqual([]);
  });

  it('NOT-18: con el permiso ya denegado o sin soporte, ni lo intenta', async () => {
    const notificaciones = crearRepositorioNotificacionesMock(entorno());
    expect(
      await activarNotificaciones({ notificaciones, push: crearPushMock({ estado: 'denegado' }) }),
    ).toBe('denegado');
    expect(
      await activarNotificaciones({
        notificaciones,
        push: crearPushMock({ estado: 'requiere-instalar' }),
      }),
    ).toBe('no-soportado');
  });
});

describe('desactivarNotificaciones (T-072)', () => {
  it('NOT-19: da de baja en la API y anula la suscripción del navegador', async () => {
    const notificaciones = crearRepositorioNotificacionesMock(entorno());
    const push = crearPushMock();
    await activarNotificaciones({ notificaciones, push });

    await desactivarNotificaciones({ notificaciones, push });

    expect(notificaciones.suscripciones()).toEqual([]);
    expect(await push.actual()).toBeNull();
  });

  it('NOT-19: sin red, la anula igual en el navegador (el servidor la limpia con el 410)', async () => {
    const red = entorno();
    const notificaciones = crearRepositorioNotificacionesMock(red);
    const push = crearPushMock();
    await activarNotificaciones({ notificaciones, push });
    red.conexion.fijarModo('sin-conexion');

    await desactivarNotificaciones({ notificaciones, push });

    expect(await push.actual()).toBeNull();
  });
});

describe('sincronizarSuscripcion (T-072)', () => {
  it('NOT-19: manda la suscripción a la API como mucho una vez al día por endpoint', async () => {
    const notificaciones = crearRepositorioNotificacionesMock(entorno());
    const push = crearPushMock();
    await push.suscribir('clave');
    const a = almacen();
    const deps = { notificaciones, push };

    expect(await sincronizarSuscripcion(deps, { almacen: a, ahora: AHORA })).toBe(true);
    expect(await sincronizarSuscripcion(deps, { almacen: a, ahora: AHORA })).toBe(false);
    expect(
      await sincronizarSuscripcion(deps, { almacen: a, ahora: '2026-11-05T00:00:00.000Z' }),
    ).toBe(true);
    expect(a.getItem(CLAVE_SINCRONIZADA)).toContain('demo-1');
  });

  it('NOT-19: sin permiso o sin suscripción no llama a la API', async () => {
    const notificaciones = crearRepositorioNotificacionesMock(entorno());
    const sinSuscripcion: PushDispositivo = { ...crearPushMock({ estado: 'concedido' }) };
    expect(
      await sincronizarSuscripcion(
        { notificaciones, push: crearPushMock() },
        { almacen: almacen(), ahora: AHORA },
      ),
    ).toBe(false);
    expect(
      await sincronizarSuscripcion(
        { notificaciones, push: sinSuscripcion },
        { almacen: almacen(), ahora: AHORA },
      ),
    ).toBe(false);
    expect(notificaciones.suscripciones()).toEqual([]);
  });
});

describe('la oferta tras un reporte (T-072, D-042)', () => {
  const base = {
    estado: 'pendiente' as const,
    claveActiva: true,
    descartadaEn: null,
    ahora: AHORA,
  };

  it('NOT-18: se ofrece si el permiso no se ha pedido y el servidor tiene claves', () => {
    expect(debeOfrecerNotificaciones(base)).toBe(true);
    expect(debeOfrecerNotificaciones({ ...base, claveActiva: false })).toBe(false);
    for (const estado of ['concedido', 'denegado', 'no-soportado', 'requiere-instalar'] as const) {
      expect(debeOfrecerNotificaciones({ ...base, estado })).toBe(false);
    }
  });

  it('NOT-18: tras "Ahora no" no vuelve hasta dentro de una semana', () => {
    const a = almacen();
    guardarDescarteOferta(a, AHORA);
    const descartadaEn = leerDescarteOferta(a);
    expect(descartadaEn).toBe(AHORA);
    expect(
      debeOfrecerNotificaciones({ ...base, descartadaEn, ahora: '2026-11-09T23:00:00.000Z' }),
    ).toBe(false);
    expect(
      debeOfrecerNotificaciones({ ...base, descartadaEn, ahora: '2026-11-10T23:00:00.000Z' }),
    ).toBe(true);
  });

  it('NOT-18: sin localStorage (modo privado) no se rompe: se ofrece', () => {
    const roto = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
      removeItem: () => undefined,
    };
    expect(() => guardarDescarteOferta(roto, AHORA)).not.toThrow();
    expect(leerDescarteOferta(roto)).toBeNull();
    expect(leerDescarteOferta(undefined)).toBeNull();
  });
});
