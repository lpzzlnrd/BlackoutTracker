import { describe, expect, it } from 'vitest';
import {
  CLAVE_BIENVENIDA,
  crearRecuerdoBienvenida,
  leerVista,
  mostrarBienvenida,
  siguientePaso,
} from './bienvenida';

const memoria = (inicial: Record<string, string> = {}) => {
  const datos = new Map(Object.entries(inicial));
  return {
    datos,
    getItem: (clave: string) => datos.get(clave) ?? null,
    setItem: (clave: string, valor: string) => void datos.set(clave, valor),
  };
};

const roto = {
  getItem: (): string | null => {
    throw new Error('SecurityError');
  },
  setItem: (): void => {
    throw new Error('QuotaExceededError');
  },
};

describe('mostrarBienvenida', () => {
  it('D-041: sale en la primera visita sin sesión, en cualquier pantalla menos la guía', () => {
    expect(mostrarBienvenida({ hayUsuario: false, vista: false, ruta: '/' })).toBe(true);
    expect(mostrarBienvenida({ hayUsuario: false, vista: false, ruta: '/reportar' })).toBe(true);
    expect(mostrarBienvenida({ hayUsuario: false, vista: false, ruta: '/guia' })).toBe(false);
  });

  it('D-041: no sale si ya se vio o si hay sesión (quien tiene cuenta no es nuevo)', () => {
    expect(mostrarBienvenida({ hayUsuario: false, vista: true, ruta: '/' })).toBe(false);
    expect(mostrarBienvenida({ hayUsuario: true, vista: false, ruta: '/' })).toBe(false);
  });
});

describe('crearRecuerdoBienvenida', () => {
  it('D-041: marcar la guarda en el dispositivo y avisa a quien la mira', () => {
    const almacen = memoria();
    const recuerdo = crearRecuerdoBienvenida(almacen);
    let avisos = 0;
    recuerdo.vista.suscribir(() => avisos++);

    expect(recuerdo.vista.leer()).toBe(false);
    recuerdo.marcar();
    expect(recuerdo.vista.leer()).toBe(true);
    expect(almacen.datos.get(CLAVE_BIENVENIDA)).toBe('1');
    expect(avisos).toBe(1);
    // La próxima visita la lee del almacén.
    expect(crearRecuerdoBienvenida(almacen).vista.leer()).toBe(true);
  });

  it('D-041: sin almacenamiento (modo privado) se recuerda mientras la pestaña siga abierta', () => {
    expect(leerVista(roto)).toBe(false);
    expect(leerVista(undefined)).toBe(false);
    const recuerdo = crearRecuerdoBienvenida(roto);
    expect(() => recuerdo.marcar()).not.toThrow();
    expect(recuerdo.vista.leer()).toBe(true);
  });
});

describe('siguientePaso', () => {
  it('D-041: la guía termina en lo que le falta al vecino', () => {
    expect(siguientePaso({ hayUsuario: false, tienePerfil: false })).toBe('crear-cuenta');
    expect(siguientePaso({ hayUsuario: true, tienePerfil: false })).toBe('marcar-vivienda');
    expect(siguientePaso({ hayUsuario: true, tienePerfil: true })).toBe('reportar');
  });
});
