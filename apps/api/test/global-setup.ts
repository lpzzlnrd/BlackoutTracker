import { join } from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { opcionesConexion } from '../src/db/db.module';
import { URL_BD_TEST } from './entorno';

/** Aplica las migraciones a `blackout_test` una vez antes de todas las suites. */
export default async function globalSetup(): Promise<void> {
  const cliente = postgres(URL_BD_TEST, { ...opcionesConexion(URL_BD_TEST), max: 1 });
  try {
    await migrate(drizzle(cliente), { migrationsFolder: join(__dirname, '../drizzle') });
  } finally {
    await cliente.end();
  }
}
