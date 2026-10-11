import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  pgTable,
  smallint,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { tipoServicioEnum } from './enums';
import { residentes } from './residentes';
import { sectores } from './sectores';

const marca = (nombre: string) => timestamp(nombre, { withTimezone: true });

/** Agua y luz van en la misma tabla, diferenciadas por `tipo_servicio` (isomorfismo). */
export const reportes = pgTable(
  'reportes',
  {
    /** Lo genera el cliente: es la clave de idempotencia (OFF-05). */
    id: uuid('id').primaryKey(),
    residenteId: uuid('residente_id')
      .notNull()
      .references(() => residentes.id),
    /** Copia del sector del residente al crear. */
    sectorId: smallint('sector_id')
      .notNull()
      .references(() => sectores.id),
    tipoServicio: tipoServicioEnum('tipo_servicio').notNull(),
    /** Hora real del evento, no la del envío (OFF-03). */
    inicioEn: marca('inicio_en').notNull(),
    /** Nula hasta el cierre. */
    finEn: marca('fin_en'),
    /** Cuándo llegó al servidor: el rastro de un envío diferido. */
    recibidoEn: marca('recibido_en').notNull().defaultNow(),
    cerradoRecibidoEn: marca('cerrado_recibido_en'),
    /** Ciclo incompleto (D-015, fase 5): deja de contar para el consenso y para REP-05. */
    vencido: boolean('vencido').notNull().default(false),
  },
  (t) => [
    // REP-07: nunca se guarda una duración negativa.
    check('reportes_fin_despues_de_inicio', sql`${t.finEn} IS NULL OR ${t.finEn} >= ${t.inicioEn}`),
    // REP-05: un solo reporte abierto por residente y servicio (agua y luz a la vez sí, REP-06).
    uniqueIndex('reportes_abierto_unico')
      .on(t.residenteId, t.tipoServicio)
      .where(sql`${t.finEn} IS NULL AND NOT ${t.vencido}`),
    index('reportes_sector_servicio_inicio').on(t.sectorId, t.tipoServicio, t.inicioEn),
  ],
);
