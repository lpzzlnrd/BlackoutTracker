import { URL_BD_TEST } from './entorno';

// La API de los tests siempre apunta a `blackout_test`, nunca a la base de desarrollo.
process.env.DATABASE_URL = URL_BD_TEST;
// Los tests firman sus propios JWT con un JWKS local; esta URL solo define el issuer esperado.
process.env.SUPABASE_URL = 'http://supabase.test';
// La API de los tests confía en X-Forwarded-For: así cada test puede simular su propia IP (throttle).
process.env.TRUST_PROXY = '1';

// Sin cron en los tests: el barrido de ventanas se invoca a mano, con el reloj controlado (T-033).
process.env.CRON_ACTIVO = 'false';

// Notificaciones (T-072): un par VAPID solo para los tests (no sirve en ningún despliegue). El
// transporte real se reemplaza por `TransportePushFalso`, así que nada sale a la red.
process.env.VAPID_PUBLIC_KEY =
  'BKLO6yh36QyQFleuAuFJYQo11q9Ekm3XPooUzM31euqDGll0ijJRcpl3nThsxTv3rQL8HOUawwioZFdWEBq0r18';
process.env.VAPID_PRIVATE_KEY = 'S8HzdLoyBfnCzDpFaX5JIpFxsWpGZptpOi82_L5kP9w';
process.env.API_URL_PUBLICA = 'https://api.test';
// Valores explícitos para que los tests no dependan del `.env` de quien los corre.
process.env.RECORDATORIOS_HORAS = '19';
process.env.SILENCIO_DESDE = '22';
process.env.SILENCIO_HASTA = '7';
