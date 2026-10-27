// Uso: pnpm db:seed:campo <ruta-al-csv>   (formato en docs/dataset-campo.md)
// Sale con código 1 si hubo filas inválidas (las válidas se guardan igual).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postgres from 'postgres';
import { opcionesConexion } from '../src/db/db.module';
import { importarCampo } from '../src/db/importar-campo';

try {
  process.loadEnvFile();
} catch {
  // sin .env: las variables ya vienen del entorno
}

async function main(): Promise<number> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Falta DATABASE_URL');
  if (!process.argv[2]) throw new Error('Uso: pnpm db:seed:campo <ruta-al-csv>');

  // pnpm corre el script desde apps/api: la ruta relativa se resuelve desde donde se lanzó pnpm.
  const texto = readFileSync(resolve(process.env.INIT_CWD ?? '.', process.argv[2]), 'utf-8');
  const sql = postgres(url, { ...opcionesConexion(url), max: 1 });
  try {
    const { insertadas, yaCargadas, invalidas } = await importarCampo(sql, texto, new Date());
    for (const { linea, motivo } of invalidas) console.warn(`Línea ${linea}: ${motivo}`);
    console.log(
      `Eventos de campo insertados: ${insertadas}. Ya cargados: ${yaCargadas}. Filas inválidas: ${invalidas.length}.`,
    );
    return invalidas.length > 0 ? 1 : 0;
  } finally {
    await sql.end();
  }
}

main()
  .then((codigo) => process.exit(codigo))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
