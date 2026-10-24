import { pgTable, smallint, timestamp, uuid } from 'drizzle-orm/pg-core';
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
});
