-- Ciclos incompletos (T-050, D-024). Generada con drizzle-kit y renumerada a 0003: la 0002 es la de
-- T-011 (RLS); su snapshot encadena con el de la 0002 y su `when` es posterior.
--
-- Un evento cuyos reportes vencieron sin ningún cierre se marca `incompleto`: deja de estar
-- abierto (sale del único parcial) pero no recibe `fin_en`, así que no entra en la mediana.
DROP INDEX "eventos_abierto_unico";--> statement-breakpoint
ALTER TABLE "eventos_sector" ADD COLUMN "incompleto" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "eventos_abierto_unico" ON "eventos_sector" USING btree ("sector_id","tipo_servicio") WHERE "eventos_sector"."fin_en" IS NULL AND NOT "eventos_sector"."incompleto";--> statement-breakpoint
ALTER TABLE "eventos_sector" ADD CONSTRAINT "eventos_incompleto_sin_fin" CHECK (NOT "eventos_sector"."incompleto" OR "eventos_sector"."fin_en" IS NULL);