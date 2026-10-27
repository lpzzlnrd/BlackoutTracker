import { defineConfig } from 'drizzle-kit';
import { cargarEnv } from './src/config/cargar-env';

// `drizzle-kit` no carga el .env por su cuenta: se lee aquí (D-030). Si no existe, se usa el entorno.
cargarEnv();

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
