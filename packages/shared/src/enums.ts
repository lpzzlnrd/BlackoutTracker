// Enums del dominio como objetos constantes y no como `enum` de TypeScript: se importan igual
// desde Nest (CJS) y desde Vite (ESM), no generan código de apoyo y funcionan con
// `isolatedModules`. Cada objeto lleva un tipo con su mismo nombre (la unión de sus valores) y
// una tupla con los valores, que piden `pgEnum` de Drizzle y `@IsIn` de class-validator.
// Los valores son los de los enums de Postgres de docs/PLAN.md §4.

/** Servicio monitoreado. Agua y luz son una sola entidad (isomorfismo, docs/PLAN.md §2). */
export const TipoServicio = {
  Agua: 'agua',
  Electricidad: 'electricidad',
} as const;
export type TipoServicio = (typeof TipoServicio)[keyof typeof TipoServicio];
/** Los valores de `TipoServicio`, en el orden del enum de Postgres. */
export const TIPOS_SERVICIO = [TipoServicio.Agua, TipoServicio.Electricidad] as const;

/** Estado consolidado de un sector para un servicio (tabla `estado_sector`). */
export const EstadoServicio = {
  ConServicio: 'con_servicio',
  SinServicio: 'sin_servicio',
} as const;
export type EstadoServicio = (typeof EstadoServicio)[keyof typeof EstadoServicio];
/** Los valores de `EstadoServicio`, en el orden del enum de Postgres. */
export const ESTADOS_SERVICIO = [EstadoServicio.ConServicio, EstadoServicio.SinServicio] as const;

/** De dónde sale un evento de sector: del consenso de los vecinos o del dataset de campo (D-008). */
export const OrigenEvento = {
  Consenso: 'consenso',
  Campo: 'campo',
} as const;
export type OrigenEvento = (typeof OrigenEvento)[keyof typeof OrigenEvento];
/** Los valores de `OrigenEvento`, en el orden del enum de Postgres. */
export const ORIGENES_EVENTO = [OrigenEvento.Consenso, OrigenEvento.Campo] as const;

/**
 * Qué cuenta una notificación push (T-072, D-042). Las dos primeras salen del consenso (un corte
 * confirmado o restablecido en tu sector); las otras tres son **recordatorios**, con tope diario.
 */
export const TipoNotificacion = {
  CorteConfirmado: 'corte_confirmado',
  ServicioRestablecido: 'servicio_restablecido',
  /** Hay reportes sin confirmar en tu sector: se te pregunta, sin sugerir la respuesta, cómo está tu casa. */
  PreguntaVecinos: 'pregunta_vecinos',
  /** Tu reporte sigue abierto más de lo que suele durar un corte del sector. */
  ReporteAbierto: 'reporte_abierto',
  /** No entraste hoy y en tu sector pasó algo. */
  ResumenDia: 'resumen_dia',
} as const;
export type TipoNotificacion = (typeof TipoNotificacion)[keyof typeof TipoNotificacion];
/** Los valores de `TipoNotificacion`, en el orden del enum de Postgres. */
export const TIPOS_NOTIFICACION = [
  TipoNotificacion.CorteConfirmado,
  TipoNotificacion.ServicioRestablecido,
  TipoNotificacion.PreguntaVecinos,
  TipoNotificacion.ReporteAbierto,
  TipoNotificacion.ResumenDia,
] as const;
/** Los tipos que son recordatorios: cuentan para el tope diario y se apagan con `recordatorios`. */
export const TIPOS_RECORDATORIO: readonly TipoNotificacion[] = [
  TipoNotificacion.PreguntaVecinos,
  TipoNotificacion.ReporteAbierto,
  TipoNotificacion.ResumenDia,
];

/** Ciclo de una notificación en la bandeja de salida. */
export const EstadoNotificacion = {
  Pendiente: 'pendiente',
  Enviada: 'enviada',
  /** Ya no tenía sentido al enviarla (el corte terminó, se pasó el tope del día, …). */
  Descartada: 'descartada',
  /** El servicio push la rechazó en todos los dispositivos del vecino. */
  Fallida: 'fallida',
} as const;
export type EstadoNotificacion = (typeof EstadoNotificacion)[keyof typeof EstadoNotificacion];
/** Los valores de `EstadoNotificacion`, en el orden del enum de Postgres. */
export const ESTADOS_NOTIFICACION = [
  EstadoNotificacion.Pendiente,
  EstadoNotificacion.Enviada,
  EstadoNotificacion.Descartada,
  EstadoNotificacion.Fallida,
] as const;

/** Botones de la pregunta a los vecinos (D-042, idea c). Las dos respuestas pesan lo mismo, a propósito. */
export const AccionNotificacion = {
  SeFue: 'se-fue',
  AquiSiHay: 'aqui-si-hay',
} as const;
export type AccionNotificacion = (typeof AccionNotificacion)[keyof typeof AccionNotificacion];
