-- PostGIS en el esquema `extensions`, como en Supabase. En el Postgres local la imagen ya lo trae
-- instalado en `public`; con `IF NOT EXISTS` esta migración no cambia nada y la conexión resuelve
-- las funciones con search_path=public,extensions (docs/PLAN.md §4).
CREATE SCHEMA IF NOT EXISTS extensions;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;
