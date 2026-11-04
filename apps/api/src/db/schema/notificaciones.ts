import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { estadoNotificacionEnum, tipoNotificacionEnum, tipoServicioEnum } from './enums';
import { eventosSector } from './eventos-sector';
import { reportes } from './reportes';
import { residentes } from './residentes';
import { sectores } from './sectores';

const marca = (nombre: string) => timestamp(nombre, { withTimezone: true });

/**
 * Un dispositivo suscrito a Web Push (T-072). Un vecino puede tener varios. Se borra sola cuando
 * el servicio push responde 404 o 410 (el navegador la anuló). Las claves son las del navegador para
 * cifrar el mensaje: sin ellas nadie más puede leerlo.
 */
export const suscripcionesPush = pgTable(
  'suscripciones_push',
  {
    /** URL del servicio push (FCM, Mozilla, Apple, Windows). Solo se aceptan esos hosts. */
    endpoint: text('endpoint').primaryKey(),
    residenteId: uuid('residente_id')
      .notNull()
      .references(() => residentes.id, { onDelete: 'cascade' }),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    creadaEn: marca('creada_en').notNull().defaultNow(),
    /** El último envío que el servicio push aceptó. */
    usadaEn: marca('usada_en'),
  },
  (t) => [index('suscripciones_push_residente').on(t.residenteId)],
);

/**
 * Bandeja de salida y bitácora de las notificaciones (T-072, D-042). Las de un corte se escriben en
 * la misma transacción del consenso, así que no se pierden si la API se cae antes de enviarlas, y
 * el índice único impide duplicarlas. El texto se redacta al enviar, con los datos de ese momento.
 */
export const notificaciones = pgTable(
  'notificaciones',
  {
    /** Viaja en el push: la app lo devuelve al abrirla (`abierta_en`). */
    id: uuid('id').primaryKey().defaultRandom(),
    residenteId: uuid('residente_id')
      .notNull()
      .references(() => residentes.id, { onDelete: 'cascade' }),
    tipo: tipoNotificacionEnum('tipo').notNull(),
    sectorId: smallint('sector_id')
      .notNull()
      .references(() => sectores.id),
    /** Nulo solo en el resumen del día, que habla de los dos servicios. */
    tipoServicio: tipoServicioEnum('tipo_servicio'),
    eventoId: integer('evento_id').references(() => eventosSector.id),
    reporteId: uuid('reporte_id').references(() => reportes.id),
    /** Hechos del momento de encolarla: `{ vecinos, aporto }`. */
    datos: jsonb('datos').$type<DatosNotificacion>().notNull().default({}),
    estado: estadoNotificacionEnum('estado').notNull().default('pendiente'),
    creadaEn: marca('creada_en').notNull().defaultNow(),
    /** No sale antes de esta hora: así se respetan las horas silenciosas. */
    programadaPara: marca('programada_para').notNull(),
    enviadaEn: marca('enviada_en'),
    abiertaEn: marca('abierta_en'),
  },
  (t) => [
    // Una sola por vecino, corte y tipo, aunque el consenso se reevalúe con N + 1 reportes.
    uniqueIndex('notificaciones_evento_unica')
      .on(t.residenteId, t.eventoId, t.tipo)
      .where(sql`${t.eventoId} IS NOT NULL`),
    // «¿Ya volvió?» se pregunta una sola vez por reporte.
    uniqueIndex('notificaciones_reporte_unica')
      .on(t.residenteId, t.reporteId, t.tipo)
      .where(sql`${t.reporteId} IS NOT NULL`),
    index('notificaciones_pendientes')
      .on(t.programadaPara)
      .where(sql`${t.estado} = 'pendiente'`),
    index('notificaciones_residente_creada').on(t.residenteId, t.creadaEn),
  ],
);

export interface DatosNotificacion {
  /** Vecinos distintos que confirmaron el corte o su restablecimiento. */
  vecinos?: number;
  /** El destinatario es uno de ellos. */
  aporto?: boolean;
}
