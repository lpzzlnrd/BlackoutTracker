import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';
import { opcionesConexion } from '../src/db/db.module';
import { migrar } from '../src/db/migrar';
import { leerLugares, leerZona, sembrarZona } from '../src/db/sembrar-zona';
import { URL_BD_TEST } from './entorno';

const DATOS = join(__dirname, '../../../data');
const leer = (archivo: string): unknown => JSON.parse(readFileSync(join(DATOS, archivo), 'utf-8'));

/**
 * Antes de todas las suites: aplica las migraciones a `blackout_test` y siembra la zona real (la
 * Gran Valencia) y sus lugares, que ninguna suite borra (D-040).
 */
export default async function globalSetup(): Promise<void> {
  await migrar(URL_BD_TEST);
  const sql = postgres(URL_BD_TEST, { ...opcionesConexion(URL_BD_TEST), max: 1 });
  try {
    await sembrarZona(
      sql,
      leerZona(leer('zona-gran-valencia.geojson')),
      leerLugares(leer('lugares-gran-valencia.geojson')),
    );
  } finally {
    await sql.end();
  }
}
