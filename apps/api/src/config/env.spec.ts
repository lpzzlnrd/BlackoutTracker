import { validarEnv } from './env';

describe('validarEnv', () => {
  it('usa los valores por defecto de @blackout/shared', () => {
    const env = validarEnv({});
    expect(env).toMatchObject({ PORT: 3000, CONSENSO_N: 3, ESTIMACION_N_MIN: 5 });
    expect(env.CONSENSO_VENTANA_MIN_AGUA).toBe(180);
    expect(env.CONSENSO_VENTANA_MIN_ELECTRICIDAD).toBe(30);
  });

  it('convierte los números que llegan como texto', () => {
    expect(validarEnv({ PORT: '4000', CONSENSO_N: '5' })).toMatchObject({
      PORT: 4000,
      CONSENSO_N: 5,
    });
  });

  it('falla con un valor que no sirve', () => {
    expect(() => validarEnv({ CONSENSO_N: '0' })).toThrow(/CONSENSO_N/);
    expect(() => validarEnv({ PORT: 'abc' })).toThrow(/PORT/);
  });
});
