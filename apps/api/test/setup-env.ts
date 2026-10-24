import { URL_BD_TEST } from './entorno';

// La API de los tests siempre apunta a `blackout_test`, nunca a la base de desarrollo.
process.env.DATABASE_URL = URL_BD_TEST;
// Los tests firman sus propios JWT con un JWKS local; esta URL solo define el issuer esperado.
process.env.SUPABASE_URL = 'http://supabase.test';
