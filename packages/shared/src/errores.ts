// Códigos de error de la API. La respuesta de error es el estándar de Nest más un campo `codigo`,
// para que el frontend muestre mensajes en español sin depender del texto del servidor
// (docs/PLAN.md §5). El plan nombra cuatro (PIN_FUERA_DE_GUAPARO, REGISTRO_INCOMPLETO,
// REPORTE_CONFLICTO y HORA_INVALIDA) y TAREAS.md uno más (REPORTE_ABIERTO_DUPLICADO). Los otros
// siete ponen nombre a estados HTTP que el plan menciona sin nombre: son una propuesta (D-018).

export const CodigoError = {
  /** 400. El cuerpo o los parámetros no cumplen el formato. */
  DatosInvalidos: 'DATOS_INVALIDOS',
  /** 401. Falta el token, está vencido o su firma o su emisor no son válidos. */
  NoAutenticado: 'NO_AUTENTICADO',
  /** 403. Hay usuario de Auth pero todavía no perfil de residente (D-014). */
  RegistroIncompleto: 'REGISTRO_INCOMPLETO',
  /** 409. `POST /residentes/me` cuando el perfil ya existe. */
  ResidenteYaRegistrado: 'RESIDENTE_YA_REGISTRADO',
  /** 422. El pin no cae dentro de ningún sector de Guaparo (REG-02). */
  PinFueraDeGuaparo: 'PIN_FUERA_DE_GUAPARO',
  /** 404. El sector no existe. */
  SectorNoEncontrado: 'SECTOR_NO_ENCONTRADO',
  /** 404. Cierre de un reporte inexistente o ajeno: un cierre sin inicio se bloquea (D-003). */
  ReporteNoEncontrado: 'REPORTE_NO_ENCONTRADO',
  /** 409. Ya hay un reporte abierto del mismo servicio (REP-05). */
  ReporteAbiertoDuplicado: 'REPORTE_ABIERTO_DUPLICADO',
  /** 409. El mismo id llega con otro contenido, o se cierra distinto un reporte ya cerrado. */
  ReporteConflicto: 'REPORTE_CONFLICTO',
  /** 422. Hora en el futuro, demasiado antigua o con el fin antes del inicio (REP-07, D-013). */
  HoraInvalida: 'HORA_INVALIDA',
  /** 429. Se superó el límite de solicitudes. */
  DemasiadasSolicitudes: 'DEMASIADAS_SOLICITUDES',
  /** 500. Error no previsto del servidor. */
  ErrorInterno: 'ERROR_INTERNO',
} as const;
export type CodigoError = (typeof CodigoError)[keyof typeof CodigoError];

/** Estado HTTP con el que la API responde a cada código. */
export const ESTADO_HTTP_DE_CODIGO = {
  [CodigoError.DatosInvalidos]: 400,
  [CodigoError.NoAutenticado]: 401,
  [CodigoError.RegistroIncompleto]: 403,
  [CodigoError.ResidenteYaRegistrado]: 409,
  [CodigoError.PinFueraDeGuaparo]: 422,
  [CodigoError.SectorNoEncontrado]: 404,
  [CodigoError.ReporteNoEncontrado]: 404,
  [CodigoError.ReporteAbiertoDuplicado]: 409,
  [CodigoError.ReporteConflicto]: 409,
  [CodigoError.HoraInvalida]: 422,
  [CodigoError.DemasiadasSolicitudes]: 429,
  [CodigoError.ErrorInterno]: 500,
} as const satisfies Readonly<Record<CodigoError, number>>;

/** Cuerpo de toda respuesta de error: el estándar de Nest más `codigo`. */
export interface ErrorApi {
  statusCode: number;
  /** Texto del servidor; una lista cuando falla la validación de varios campos. */
  message: string | string[];
  /** Nombre del estado HTTP, p. ej. "Unprocessable Entity". */
  error: string;
  codigo: CodigoError;
}
