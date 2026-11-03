import { index, pgTable, smallint, text } from 'drizzle-orm/pg-core';
import { multiPoligono } from '../tipos-geo';
import { municipios } from './municipios';

/**
 * Un sector es una celda hexagonal H3 (T-070, D-040). Se crea solo cuando se registra el primer
 * residente de la celda, así que existen únicamente los sectores con vecinos. `geom` es el
 * hexágono (para el mapa); la asignación va por `celda_h3`, que no tiene empates en los bordes.
 */
export const sectores = pgTable(
  'sectores',
  {
    id: smallint('id').primaryKey().generatedByDefaultAsIdentity(),
    nombre: text('nombre').notNull().unique(),
    /** Índice H3 de la celda, en hexadecimal (`8867432a23fffff`). */
    celdaH3: text('celda_h3').notNull().unique(),
    /** El municipio que contiene el centro de la celda. */
    municipioId: smallint('municipio_id')
      .notNull()
      .references(() => municipios.id),
    geom: multiPoligono('geom').notNull(),
  },
  (t) => [index('sectores_geom_gist').using('gist', t.geom)],
);
