-- Notificaciones push (T-072, D-042). Generada con drizzle-kit; el RLS del final va a mano
-- (drizzle-kit no modela RLS).
--
-- `suscripciones_push` guarda los dispositivos de cada vecino y `notificaciones` es la bandeja de
-- salida: el consenso escribe en ella dentro de su transacción y un cron de Nest envía. En
-- `residentes`, `ultimo_ingreso` decide los recordatorios y las otras dos columnas son preferencias.
CREATE TYPE "public"."estado_notificacion" AS ENUM('pendiente', 'enviada', 'descartada', 'fallida');--> statement-breakpoint
CREATE TYPE "public"."tipo_notificacion" AS ENUM('corte_confirmado', 'servicio_restablecido', 'pregunta_vecinos', 'reporte_abierto', 'resumen_dia');--> statement-breakpoint
CREATE TABLE "notificaciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"residente_id" uuid NOT NULL,
	"tipo" "tipo_notificacion" NOT NULL,
	"sector_id" smallint NOT NULL,
	"tipo_servicio" "tipo_servicio",
	"evento_id" integer,
	"reporte_id" uuid,
	"datos" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"estado" "estado_notificacion" DEFAULT 'pendiente' NOT NULL,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL,
	"programada_para" timestamp with time zone NOT NULL,
	"enviada_en" timestamp with time zone,
	"abierta_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "suscripciones_push" (
	"endpoint" text PRIMARY KEY NOT NULL,
	"residente_id" uuid NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL,
	"usada_en" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "residentes" ADD COLUMN "ultimo_ingreso" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "residentes" ADD COLUMN "recordatorios" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "residentes" ADD COLUMN "agua_de_noche" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_residente_id_residentes_id_fk" FOREIGN KEY ("residente_id") REFERENCES "public"."residentes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_sector_id_sectores_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."sectores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_evento_id_eventos_sector_id_fk" FOREIGN KEY ("evento_id") REFERENCES "public"."eventos_sector"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_reporte_id_reportes_id_fk" FOREIGN KEY ("reporte_id") REFERENCES "public"."reportes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suscripciones_push" ADD CONSTRAINT "suscripciones_push_residente_id_residentes_id_fk" FOREIGN KEY ("residente_id") REFERENCES "public"."residentes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notificaciones_evento_unica" ON "notificaciones" USING btree ("residente_id","evento_id","tipo") WHERE "notificaciones"."evento_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "notificaciones_reporte_unica" ON "notificaciones" USING btree ("residente_id","reporte_id","tipo") WHERE "notificaciones"."reporte_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "notificaciones_pendientes" ON "notificaciones" USING btree ("programada_para") WHERE "notificaciones"."estado" = 'pendiente';--> statement-breakpoint
CREATE INDEX "notificaciones_residente_creada" ON "notificaciones" USING btree ("residente_id","creada_en");--> statement-breakpoint
CREATE INDEX "suscripciones_push_residente" ON "suscripciones_push" USING btree ("residente_id");--> statement-breakpoint
-- RLS deny-all, como las demás tablas (0002, NF-06): la API se lo salta y nadie más las lee. Las
-- claves de cifrado de los navegadores no pueden quedar al alcance de la Data API de Supabase.
ALTER TABLE "notificaciones" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "suscripciones_push" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON "notificaciones", "suscripciones_push" FROM anon, authenticated;--> statement-breakpoint
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;