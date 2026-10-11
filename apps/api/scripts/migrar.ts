// Uso: pnpm db:migrate   (aplica las migraciones a DATABASE_URL)
import { migrar } from '../src/db/migrar';

try {
  process.loadEnvFile();
} catch {
  // sin .env: las variables ya vienen del entorno
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Falta DATABASE_URL');
  process.exit(1);
}

migrar(url).then(
  () => console.log('Migraciones aplicadas.'),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
