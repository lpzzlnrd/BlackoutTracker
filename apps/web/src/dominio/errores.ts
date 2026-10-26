import { CodigoError, type TipoServicio } from '@blackout/shared';

/**
 * Error de una llamada a la API. `estado` es el HTTP, o 0 si no hubo respuesta (red caída o
 * tiempo agotado). Lo lanzan por igual los adaptadores reales y los mocks, así el resto de la
 * app no distingue de dónde viene.
 */
export class ErrorApiCliente extends Error {
  constructor(
    readonly estado: number,
    readonly codigo?: CodigoError,
    mensaje?: string,
  ) {
    super(mensaje ?? (codigo ? `${estado} ${codigo}` : `Error ${estado}`));
    this.name = 'ErrorApiCliente';
  }

  get esDeRed(): boolean {
    return this.estado === 0;
  }
}

const NOMBRE_SERVICIO: Record<TipoServicio, string> = { agua: 'agua', electricidad: 'luz' };

/** Texto en español de cada código (datos.md §5). Nunca se muestra el `message` del servidor. */
export function mensajeDeError(codigo: CodigoError | undefined, servicio?: TipoServicio): string {
  switch (codigo) {
    case CodigoError.DatosInvalidos:
      return 'Algunos datos no son válidos. Revísalos e inténtalo de nuevo.';
    case CodigoError.NoAutenticado:
      return 'Tu sesión venció. Inicia sesión de nuevo.';
    case CodigoError.RegistroIncompleto:
      return 'Falta terminar tu registro. Marca tu vivienda en el mapa para continuar.';
    case CodigoError.SectorNoEncontrado:
      return 'No encontramos ese sector.';
    case CodigoError.ReporteNoEncontrado:
      return 'No hay un corte abierto que cerrar.';
    case CodigoError.ResidenteYaRegistrado:
      return 'Ya tienes una vivienda registrada con esta cuenta.';
    case CodigoError.ReporteAbiertoDuplicado:
      return `Ya tienes un corte de ${servicio ? NOMBRE_SERVICIO[servicio] : 'ese servicio'} abierto. Ciérralo antes de avisar de otro.`;
    case CodigoError.ReporteConflicto:
      return 'No se pudo enviar este aviso. Vuelve a crearlo.';
    case CodigoError.PinFueraDeGuaparo:
      return 'Ese punto queda fuera de Guaparo. Mueve el pin sobre tu vivienda.';
    case CodigoError.HoraInvalida:
      return 'La hora no es válida. Revisa que no sea futura, muy antigua ni anterior al inicio.';
    case CodigoError.DemasiadasSolicitudes:
      return 'Demasiados intentos seguidos. Espera un momento e inténtalo otra vez.';
    default:
      return 'Algo falló de nuestro lado. Inténtalo de nuevo en un momento.';
  }
}

/** Qué hace la cola con una respuesta (PLAN.md §5, PWA.md §7). Lo decide el estado, no el código. */
export type ResolucionAviso = 'reintentar' | 'permanente' | 'renovar-sesion';

export function resolverFallo(
  error: ErrorApiCliente,
  accion: 'inicio' | 'cierre',
): ResolucionAviso {
  const { estado } = error;
  if (estado === 401) return 'renovar-sesion';
  if (estado === 0 || estado >= 500 || estado === 429) return 'reintentar';
  // Un cierre cuyo inicio todavía está en camino: el 404 se reintenta.
  if (estado === 404 && accion === 'cierre') return 'reintentar';
  return 'permanente';
}
