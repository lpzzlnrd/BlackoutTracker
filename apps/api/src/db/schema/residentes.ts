import { boolean, pgTable, smallint, timestamp, uuid } from 'drizzle-orm/pg-core';
import { punto } from '../tipos-geo';
import { sectores } from './sectores';

export const residentes = pgTable('residentes', {
  /** Es el `sub` del JWT de Supabase. */
  id: uuid('id').primaryKey(),
  sectorId: smallint('sector_id')
    .notNull()
    .references(() => sectores.id),
  /** NUNCA sale por la API (NF-06). */
  ubicacion: punto('ubicacion').notNull(),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  /**
   * La última vez que abrió la app con sesión (`GET /residentes/me`), con 15 min de resolución. Los
   * recordatorios solo van a quien no entró en el día (T-072, D-042). Nunca sale por la API.
   */
  ultimoIngreso: timestamp('ultimo_ingreso', { withTimezone: true }),
  /** Recordatorios y preguntas a los vecinos (tope diario). Los avisos de corte no dependen de esto. */
  recordatorios: boolean('recordatorios').notNull().default(true),
  /** «Llegó el agua» suena aunque sea en horas silenciosas. */
  aguaDeNoche: boolean('agua_de_noche').notNull().default(false),
});
