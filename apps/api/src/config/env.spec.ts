import { validarEnv } from './env';

const URL = 'postgres://postgres:postgres@localhost:5433/blackout';
const BASE = { DATABASE_URL: URL, SUPABASE_URL: 'https://abc.supabase.co' };

describe('validarEnv', () => {
  it('usa los valores por defecto de @blackout/shared', () => {
    const env = validarEnv(BASE);
    expect(env).toMatchObject({ PORT: 3000, CONSENSO_N: 3, ESTIMACION_N_MIN: 5 });
    expect(env.CONSENSO_VENTANA_MIN_AGUA).toBe(180);
    expect(env.CONSENSO_VENTANA_MIN_ELECTRICIDAD).toBe(30);
  });

  it('convierte los números que llegan como texto', () => {
    expect(validarEnv({ ...BASE, PORT: '4000', CONSENSO_N: '5' })).toMatchObject({
      PORT: 4000,
      CONSENSO_N: 5,
    });
  });

  it('falla con un valor que no sirve', () => {
    expect(() => validarEnv({ ...BASE, CONSENSO_N: '0' })).toThrow(/CONSENSO_N/);
    expect(() => validarEnv({ ...BASE, PORT: 'abc' })).toThrow(/PORT/);
  });

  it('exige SUPABASE_URL', () => {
    expect(() => validarEnv({ DATABASE_URL: URL })).toThrow(/SUPABASE_URL/);
  });

  it('exige DATABASE_URL', () => {
    expect(() => validarEnv({ SUPABASE_URL: BASE.SUPABASE_URL })).toThrow(/DATABASE_URL/);
  });
});
