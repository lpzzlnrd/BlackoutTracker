-- RLS deny-all y Realtime de estado_sector (T-011, NF-06). SQL a mano: drizzle-kit no modela RLS.
--
-- Nest se conecta con un rol que se salta RLS (en Supabase, `postgres`, dueño de las tablas), así
-- que nada de esto le afecta. Esto cierra la Data API de Supabase (PostgREST) y Realtime, que
-- entran como `anon` o `authenticated`: lo único que pueden leer es `estado_sector`.

-- En Supabase estos roles ya existen. En el PostGIS local no, y sin ellos el REVOKE falla.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END
$$;
--> statement-breakpoint
ALTER TABLE "sectores" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "residentes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "reportes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "eventos_sector" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "estado_sector" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- Defensa en profundidad: Supabase da ALL a anon y authenticated sobre las tablas nuevas de
-- `public`, así que sin el REVOKE solo RLS (sin políticas) los frenaría.
REVOKE ALL ON "sectores", "residentes", "reportes", "eventos_sector", "estado_sector" FROM anon, authenticated;--> statement-breakpoint
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;--> statement-breakpoint
GRANT SELECT ON "estado_sector" TO anon, authenticated;--> statement-breakpoint
CREATE POLICY "estado_sector_lectura" ON "estado_sector" FOR SELECT TO anon, authenticated USING (true);--> statement-breakpoint
-- Realtime (VIS-03): solo estado_sector. Si la publicación no existe (PostGIS local) no hace nada,
-- y si la tabla ya está en ella tampoco falla.
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'estado_sector'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.estado_sector;
  END IF;
END
$$;
