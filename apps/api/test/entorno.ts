/** Base de los tests de integración: `pnpm db:up` la crea (T-004). */
export const URL_BD_TEST =
  process.env.DATABASE_URL_TEST ?? 'postgres://postgres:postgres@localhost:5433/blackout_test';
