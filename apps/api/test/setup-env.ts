import { URL_BD_TEST } from './entorno';

// La API de los tests siempre apunta a `blackout_test`, nunca a la base de desarrollo.
process.env.DATABASE_URL = URL_BD_TEST;
// Los tests firman sus propios JWT con un JWKS local; esta URL solo define el issuer esperado.
process.env.SUPABASE_URL = 'http://supabase.test';
// La API de los tests confía en X-Forwarded-For: así cada test puede simular su propia IP (throttle).
process.env.TRUST_PROXY = '1';
