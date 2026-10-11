import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';
import { opcionesConexion } from '../src/db/db.module';
import * as schema from '../src/db/schema';
import { URL_BD_TEST } from './entorno';

export interface BdTest {
  sql: Sql;
  db: PostgresJsDatabase<typeof schema>;
}

/** Conexión a `blackout_test`, con el mismo `search_path` que la API. */
export function abrirBd(): BdTest {
  const sql = postgres(URL_BD_TEST, opcionesConexion(URL_BD_TEST));
  return { sql, db: drizzle(sql, { schema }) };
}

/** Vacía todas las tablas de datos y reinicia las secuencias. Cada suite la llama en `beforeEach`. */
export async function limpiar(sql: Sql): Promise<void> {
  await sql`truncate table estado_sector, eventos_sector, reportes, residentes, sectores restart identity cascade`;
}

/** Código SQLSTATE de un error de postgres-js, también si Drizzle lo envolvió en `cause`. */
export function codigoPg(error: unknown): string | undefined {
  const e = error as { code?: string; cause?: { code?: string } };
  return e?.code ?? e?.cause?.code;
}

/** Cuadrado de lado `lado` grados con la esquina inferior izquierda en (lng, lat), como GeoJSON. */
export function cuadrado(lng: number, lat: number, lado = 0.01) {
  return {
    type: 'MultiPolygon',
    coordinates: [
      [
        [
          [lng, lat],
          [lng + lado, lat],
          [lng + lado, lat + lado],
          [lng, lat + lado],
          [lng, lat],
        ],
      ],
    ],
  };
}
