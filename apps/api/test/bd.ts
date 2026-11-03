import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';
import { opcionesConexion } from '../src/db/db.module';
import * as schema from '../src/db/schema';
import { asegurarSector } from '../src/sectores/ubicacion';
import { URL_BD_TEST } from './entorno';
import { DENTRO, NOMBRE_SECTOR } from './fixtures/puntos';

export interface BdTest {
  sql: Sql;
  db: PostgresJsDatabase<typeof schema>;
}

/** Conexión a `blackout_test`, con el mismo `search_path` que la API. */
export function abrirBd(): BdTest {
  const sql = postgres(URL_BD_TEST, opcionesConexion(URL_BD_TEST));
  return { sql, db: drizzle(sql, { schema }) };
}

/**
 * Vacía las tablas de datos y reinicia las secuencias. Cada suite la llama en `beforeEach`. La zona
 * (`municipios`, `lugares`) no se toca: la siembra `global-setup.ts` una vez.
 */
export async function limpiar(sql: Sql): Promise<void> {
  await sql`truncate table estado_sector, eventos_sector, reportes, residentes, sectores restart identity cascade`;
}

/**
 * Crea los 4 sectores de prueba (ids 1 a 4, en el orden de `DENTRO`) por el mismo camino que el
 * registro, pero con nombres fijos para que los tests no dependan de los lugares de OSM.
 */
export async function crearSectoresDePrueba(db: BdTest['db']): Promise<void> {
  for (const clave of Object.keys(DENTRO) as Array<keyof typeof DENTRO>) {
    const { lat, lng } = DENTRO[clave];
    await db.transaction((tx) => asegurarSector(tx, lat, lng, NOMBRE_SECTOR[clave]));
  }
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
