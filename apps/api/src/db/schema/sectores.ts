import { index, pgTable, smallint, text } from 'drizzle-orm/pg-core';
import { multiPoligono } from '../tipos-geo';

/** "Guaparo" es la unión de los sectores; no hay una tabla aparte para el polígono exterior. */
export const sectores = pgTable(
  'sectores',
  {
    id: smallint('id').primaryKey().generatedByDefaultAsIdentity(),
    nombre: text('nombre').notNull().unique(),
    geom: multiPoligono('geom').notNull(),
  },
  (t) => [index('sectores_geom_gist').using('gist', t.geom)],
);
