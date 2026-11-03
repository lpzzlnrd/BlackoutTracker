import { index, integer, pgTable, real, smallint, text } from 'drizzle-orm/pg-core';
import { multiPoligono, punto } from '../tipos-geo';

/**
 * La zona de cobertura (T-070, D-040): los municipios de la Gran Valencia. Un pin es válido si
 * cae dentro de alguno (REG-02). Se siembran desde `data/zona-gran-valencia.geojson`.
 */
export const municipios = pgTable(
  'municipios',
  {
    id: smallint('id').primaryKey().generatedByDefaultAsIdentity(),
    nombre: text('nombre').notNull().unique(),
    geom: multiPoligono('geom').notNull(),
  },
  (t) => [index('municipios_geom_gist').using('gist', t.geom)],
);

/**
 * Lugares con nombre de OSM (barrios, urbanizaciones, pueblos). Solo sirven para nombrar los
 * sectores: cada sector toma el del lugar más cercano, con la distancia multiplicada por `peso`.
 * Se siembran desde `data/lugares-gran-valencia.geojson`.
 */
export const lugares = pgTable('lugares', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  nombre: text('nombre').notNull(),
  peso: real('peso').notNull().default(1),
  geom: punto('geom').notNull(),
});
