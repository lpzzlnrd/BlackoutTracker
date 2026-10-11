import { validarEnv } from './env';

const URL = 'postgres://postgres:postgres@localhost:5433/blackout';

describe('validarEnv', () => {
  it('usa los valores por defecto de @blackout/shared', () => {
    const env = validarEnv({ DATABASE_URL: URL });
    expect(env).toMatchObject({ PORT: 3000, CONSENSO_N: 3, ESTIMACION_N_MIN: 5 });
    expect(env.CONSENSO_VENTANA_MIN_AGUA).toBe(180);
    expect(env.CONSENSO_VENTANA_MIN_ELECTRICIDAD).toBe(30);
  });

  it('convierte los números que llegan como texto', () => {
    expect(validarEnv({ DATABASE_URL: URL, PORT: '4000', CONSENSO_N: '5' })).toMatchObject({
      PORT: 4000,
      CONSENSO_N: 5,
    });
  });

  it('falla con un valor que no sirve', () => {
    expect(() => validarEnv({ DATABASE_URL: URL, CONSENSO_N: '0' })).toThrow(/CONSENSO_N/);
    expect(() => validarEnv({ DATABASE_URL: URL, PORT: 'abc' })).toThrow(/PORT/);
  });

  it('exige DATABASE_URL', () => {
    expect(() => validarEnv({})).toThrow(/DATABASE_URL/);
  });
});
