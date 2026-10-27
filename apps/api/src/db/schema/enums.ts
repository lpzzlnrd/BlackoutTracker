import { pgEnum } from 'drizzle-orm/pg-core';
import { ESTADOS_SERVICIO, ORIGENES_EVENTO, TIPOS_SERVICIO } from '@blackout/shared';

// Los valores y su orden vienen de `@blackout/shared` (D-018): el bloqueo por sector usa el ordinal
// del enum de Postgres (docs/PLAN.md §6.3).
export const tipoServicioEnum = pgEnum('tipo_servicio', TIPOS_SERVICIO);
export const estadoServicioEnum = pgEnum('estado_servicio', ESTADOS_SERVICIO);
export const origenEventoEnum = pgEnum('origen_evento', ORIGENES_EVENTO);
