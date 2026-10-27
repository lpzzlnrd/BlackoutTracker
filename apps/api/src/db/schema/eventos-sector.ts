import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  pgTable,
  serial,
  smallint,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { origenEventoEnum, tipoServicioEnum } from './enums';
import { sectores } from './sectores';

const marca = (nombre: string) => timestamp(nombre, { withTimezone: true });

/** El corte confirmado por consenso (o cargado del dataset de campo). */
export const eventosSector = pgTable(
  'eventos_sector',
  {
    id: serial('id').primaryKey(),
    sectorId: smallint('sector_id')
      .notNull()
      .references(() => sectores.id),
    tipoServicio: tipoServicioEnum('tipo_servicio').notNull(),
    /** Mediana de las horas de los N reportes que confirmaron (D-007). */
    inicioEn: marca('inicio_en').notNull(),
    finEn: marca('fin_en'),
    /** Cuándo se alcanzó el consenso. */
    confirmadoEn: marca('confirmado_en').notNull(),
    restablecidoEn: marca('restablecido_en'),
    origen: origenEventoEnum('origen').notNull().default('consenso'),
    /**
     * Ciclo incompleto (T-050, D-024): todos sus reportes vencieron sin que nadie dijera que volvió
     * el servicio. Se da por terminado sin `fin_en`, así que nunca entra en la mediana (EST).
     */
    incompleto: boolean('incompleto').notNull().default(false),
  },
  (t) => [
    check('eventos_fin_despues_de_inicio', sql`${t.finEn} IS NULL OR ${t.finEn} >= ${t.inicioEn}`),
    // Un evento incompleto no tiene hora de fin: no se sabe cuándo volvió el servicio.
    check('eventos_incompleto_sin_fin', sql`NOT ${t.incompleto} OR ${t.finEn} IS NULL`),
    // A lo sumo un evento abierto por sector y servicio (CON-03). Uno incompleto ya no está abierto.
    uniqueIndex('eventos_abierto_unico')
      .on(t.sectorId, t.tipoServicio)
      .where(sql`${t.finEn} IS NULL AND NOT ${t.incompleto}`),
  ],
);
