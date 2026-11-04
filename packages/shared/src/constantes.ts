import type { TipoServicio } from './enums';

// Valores por defecto de la configuración (docs/PLAN.md §7). La API los usa cuando falta la
// variable de entorno correspondiente; el frontend, para los textos de ayuda.

/** N: residentes distintos que deben coincidir para confirmar un corte (D-006). */
export const CONSENSO_N_POR_DEFECTO = 3;

/** W: ventana, en minutos, en la que deben coincidir los N reportes. Distinta por servicio (D-004). */
export const CONSENSO_VENTANA_MIN_POR_DEFECTO = {
  agua: 180,
  electricidad: 30,
} as const satisfies Readonly<Record<TipoServicio, number>>;

/** n_min: cortes cerrados mínimos para mostrar una estimación en lugar de "datos insuficientes". */
export const ESTIMACION_N_MIN_POR_DEFECTO = 5;

/** Un reporte no puede tener una hora más antigua que esto (D-013). */
export const REPORTE_MAX_ANTIGUEDAD_DIAS_POR_DEFECTO = 7;

/** Un reporte abierto hace más que esto se marca `vencido` (D-015, fase 5). */
export const REPORTE_VENCE_HORAS_POR_DEFECTO = 48;

/** Desfase de reloj que se tolera hacia el futuro al validar `ocurridoEn` (D-013). */
export const TOLERANCIA_RELOJ_MIN = 2;

/** Todas las horas se guardan en UTC; las pantallas las muestran en esta zona (UTC−4, sin horario de verano). */
export const ZONA_HORARIA = 'America/Caracas';

/**
 * Horas de Caracas en las que salen los recordatorios (T-072, D-042). Cada hora es una franja y el
 * tope diario es el número de franjas: con `[19]` llega a lo sumo uno al día; con `[12, 19]`, dos.
 */
export const RECORDATORIOS_HORAS_POR_DEFECTO: readonly number[] = [19];

/**
 * Horas silenciosas, en hora de Caracas: de las 22:00 a las 07:00 no suena nada, salvo «llegó el
 * agua» para quien lo pidió. Lo que se confirma de noche sale a las 07:00 si sigue vigente.
 */
export const SILENCIO_DESDE_POR_DEFECTO = 22;
export const SILENCIO_HASTA_POR_DEFECTO = 7;

/** Sin estimación suficiente, «¿ya volvió?» se pregunta cuando el reporte lleva estas horas abierto. */
export const RECORDATORIO_REPORTE_ABIERTO_HORAS_POR_DEFECTO = 12;
