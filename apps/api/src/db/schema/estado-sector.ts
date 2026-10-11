import { integer, pgTable, primaryKey, smallint, timestamp } from 'drizzle-orm/pg-core';
import { estadoServicioEnum, tipoServicioEnum } from './enums';
import { eventosSector } from './eventos-sector';
import { sectores } from './sectores';

/**
 * Lo único que el frontend lee directo, por Supabase Realtime. Una fila por sector y servicio, que
 * crea el seed. No contiene ningún dato personal.
 */
export const estadoSector = pgTable(
  'estado_sector',
  {
    sectorId: smallint('sector_id')
      .notNull()
      .references(() => sectores.id),
    tipoServicio: tipoServicioEnum('tipo_servicio').notNull(),
    estado: estadoServicioEnum('estado').notNull().default('con_servicio'),
    reportesSinConfirmar: smallint('reportes_sin_confirmar').notNull().default(0),
    eventoId: integer('evento_id').references(() => eventosSector.id),
    desde: timestamp('desde', { withTimezone: true }),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.sectorId, t.tipoServicio] })],
);
