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
