import { join } from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { opcionesConexion } from './db.module';

/**
 * Aplica las migraciones de `apps/api/drizzle`. Se usa esto y no `drizzle-kit migrate` porque
 * este último conecta sin `search_path=public,extensions`: PostGIS vive en `extensions` y el tipo
 * `geometry` no se resolvería. Con nuestra conexión el SQL es el mismo en local y en Supabase.
 */
export async function migrar(url: string): Promise<void> {
  const cliente = postgres(url, { ...opcionesConexion(url), max: 1 });
  try {
    await migrate(drizzle(cliente), { migrationsFolder: join(__dirname, '../../drizzle') });
  } finally {
    await cliente.end();
  }
}
