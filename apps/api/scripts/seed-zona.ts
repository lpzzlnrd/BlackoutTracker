// Uso: pnpm db:seed [zona.geojson] [lugares.geojson]
//   (por defecto, data/zona-gran-valencia.geojson y data/lugares-gran-valencia.geojson)
//
// Siembra la zona de cobertura (los municipios) y los lugares con los que se nombran los sectores
// (T-070, D-040). Los sectores no se siembran: nacen con el primer residente de cada celda H3.
// Es idempotente. Si cambia la zona, reinicia la API: el contorno de `GET /zona` se calcula una vez.
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import postgres from 'postgres';
import { opcionesConexion } from '../src/db/db.module';
import { leerLugares, leerZona, sembrarZona } from '../src/db/sembrar-zona';
import { cargarEnv } from '../src/config/cargar-env';

cargarEnv();

const DATOS = join(__dirname, '../../../data');
const leer = (ruta: string): unknown => JSON.parse(readFileSync(resolve(ruta), 'utf-8'));

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Falta DATABASE_URL');
  const zona = leerZona(leer(process.argv[2] ?? join(DATOS, 'zona-gran-valencia.geojson')));
  const lugares = leerLugares(
    leer(process.argv[3] ?? join(DATOS, 'lugares-gran-valencia.geojson')),
  );

  const sql = postgres(url, { ...opcionesConexion(url), max: 1 });
  try {
    const res = await sembrarZona(sql, zona, lugares);
    console.log(`Municipios: ${res.municipios}. Lugares: ${res.lugares}.`);
  } finally {
    await sql.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
