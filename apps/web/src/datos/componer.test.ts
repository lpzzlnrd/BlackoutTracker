import { describe, expect, it } from 'vitest';
import { leerModo } from './componer';

describe('leerModo', () => {
  it('sin ?demo (o con un valor desconocido) es la app real', () => {
    expect(leerModo('')).toEqual({ tipo: 'real' });
    expect(leerModo('?demo=otra')).toEqual({ tipo: 'real' });
  });

  it('?demo=en-linea y ?demo=sin-conexion activan la demo con su escenario', () => {
    expect(leerModo('?demo=en-linea')).toEqual({ tipo: 'demo', escenario: 'en-linea' });
    expect(leerModo('?demo=sin-conexion')).toEqual({ tipo: 'demo', escenario: 'sin-conexion' });
  });

  it('D-040: &vecino=nuevo deja al vecino de la demo sin vivienda marcada (el registro)', () => {
    expect(leerModo('?demo=en-linea&vecino=nuevo')).toEqual({
      tipo: 'demo',
      escenario: 'en-linea',
      vecinoNuevo: true,
    });
  });

  it('D-041: &vecino=visitante abre la demo sin sesión (la bienvenida de la primera visita)', () => {
    expect(leerModo('?demo=en-linea&vecino=visitante')).toEqual({
      tipo: 'demo',
      escenario: 'en-linea',
      visitante: true,
    });
  });
});
