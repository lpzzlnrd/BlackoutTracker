import { defineConfig } from 'drizzle-kit';

// `drizzle-kit` no carga el .env por su cuenta: se lee aquí (Node 22). Si no existe, se usa el entorno.
try {
  process.loadEnvFile();
} catch {
  // sin .env: las variables ya vienen del entorno
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/*.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5433/blackout',
  },
  // Si no, drizzle-kit intenta gestionar `spatial_ref_sys` y las demás tablas de PostGIS (docs/PLAN.md §4).
  extensionsFilters: ['postgis'],
  schemaFilter: ['public'],
});
