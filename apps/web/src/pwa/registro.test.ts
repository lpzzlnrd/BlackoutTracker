import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RegisterSWOptions } from 'vite-plugin-pwa/types';

const pwa = vi.hoisted(() => ({
  opciones: undefined as RegisterSWOptions | undefined,
  activar: vi.fn(() => Promise.resolve()),
}));

vi.mock('virtual:pwa-register', () => ({
  registerSW: (opciones: RegisterSWOptions) => {
    pwa.opciones = opciones;
    return pwa.activar;
  },
}));

const { registrarServiceWorker } = await import('./registro');

/** `navigator.serviceWorker` mínimo: un controlador, un registro y `controllerchange`. */
function swFalso(controlada: boolean) {
  const oyentes: (() => void)[] = [];
  const falso = {
    controller: controlada ? {} : null,
    registro: { waiting: {} as object | null },
    getRegistration: () => Promise.resolve(falso.registro),
    addEventListener: (tipo: string, oyente: () => void) => {
      if (tipo === 'controllerchange') oyentes.push(oyente);
    },
    cambiarControlador: () => oyentes.forEach((oyente) => oyente()),
  };
  return falso;
}

let recargar: ReturnType<typeof vi.fn>;

function preparar({ controlada = true } = {}) {
  const sw = swFalso(controlada);
  vi.stubGlobal('navigator', { serviceWorker: sw });
  const app = registrarServiceWorker();
  return { sw, app, opciones: pwa.opciones! };
}

beforeEach(() => {
  recargar = vi.fn();
  vi.stubGlobal('location', { reload: recargar });
  pwa.activar.mockClear();
});

afterEach(() => vi.unstubAllGlobals());

describe('registrarServiceWorker', () => {
  it('ofrece la versión nueva cuando hay una esperando', () => {
    const { app, opciones } = preparar();
    expect(app.versionNueva.leer()).toBe(false);
    opciones.onNeedRefresh?.();
    expect(app.versionNueva.leer()).toBe(true);
  });

  it('no la ofrece a una página sin service worker (Ctrl+Shift+R): ya trae el código nuevo', () => {
    const { app, opciones } = preparar({ controlada: false });
    opciones.onNeedRefresh?.();
    expect(app.versionNueva.leer()).toBe(false);
  });

  it('recarga cuando la versión nueva toma el control, aunque la página arrancara sin service worker', () => {
    // Es el caso del aviso pegado: workbox-window no avisa (`isUpdate` es falso) y solo queda
    // el `controllerchange` del navegador.
    const { sw, opciones } = preparar();
    opciones.onNeedRefresh?.();
    sw.cambiarControlador();
    expect(recargar).toHaveBeenCalledTimes(1);
  });

  it('no recarga cuando el primer service worker toma el control (primera visita)', () => {
    const { sw } = preparar();
    sw.cambiarControlador();
    expect(recargar).not.toHaveBeenCalled();
  });

  it('recarga una sola vez aunque avisen el plugin y el navegador', () => {
    const { sw, opciones } = preparar();
    opciones.onNeedRefresh?.();
    opciones.onNeedReload?.();
    sw.cambiarControlador();
    expect(recargar).toHaveBeenCalledTimes(1);
  });

  it('"Actualizar" activa la versión que espera', async () => {
    const { app, opciones } = preparar();
    opciones.onNeedRefresh?.();
    await app.actualizar();
    expect(pwa.activar).toHaveBeenCalledWith(true);
    expect(recargar).not.toHaveBeenCalled();
  });

  it('"Actualizar" recarga si ya no queda nada esperando (otra pestaña la activó)', async () => {
    const { sw, app, opciones } = preparar();
    opciones.onNeedRefresh?.();
    sw.registro.waiting = null;
    await app.actualizar();
    expect(pwa.activar).not.toHaveBeenCalled();
    expect(recargar).toHaveBeenCalledTimes(1);
  });
});
