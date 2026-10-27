// Uso: pnpm db:seed [ruta-al-geojson]   (por defecto, data/sectores-guaparo.geojson)
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import postgres from 'postgres';
import { opcionesConexion } from '../src/db/db.module';
import { leerSectores, sembrarSectores } from '../src/db/sembrar-sectores';
import { cargarEnv } from '../src/config/cargar-env';

cargarEnv();

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Falta DATABASE_URL');
  const ruta = resolve(
    process.argv[2] ?? join(__dirname, '../../../data/sectores-guaparo.geojson'),
  );

  const geojson: unknown = JSON.parse(readFileSync(ruta, 'utf-8'));
  if ((geojson as { provisional?: boolean }).provisional) {
    console.warn('AVISO: el GeoJSON es PROVISIONAL (D-005); no son los límites reales.');
  }
  const sql = postgres(url, { ...opcionesConexion(url), max: 1 });
  try {
    const { sectores, filasEstado } = await sembrarSectores(sql, leerSectores(geojson));
    console.log(`Sectores sembrados: ${sectores}. Filas en estado_sector: ${filasEstado}.`);
  } finally {
    await sql.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
