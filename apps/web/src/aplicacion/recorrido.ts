import { crearAlmacen, type Observable } from '../dominio/observable';

// El recorrido guiado (T-073, D-043): la primera visita se aprende usando la app real, paso a paso,
// como en un juego. Aquí solo vive la lógica pura: el orden de los pasos, cómo se avanza y cómo se
// recuerda. El texto, las pantallas y lo que se señala están en `guia/recorrido/pasos.tsx`.

/**
 * El orden del recorrido. "entrar" es la segunda mitad del paso 1: después de crear la cuenta se
 * enseña por dónde se entra la próxima vez (la sesión ya queda abierta al crearla).
 */
export const PASOS_RECORRIDO = [
  'cuenta',
  'entrar',
  'vivienda',
  'mapa',
  'avisar',
  'consenso',
  'estimacion',
  'sin-conexion',
] as const;

export type IdPaso = (typeof PASOS_RECORRIDO)[number];

/** El número que ve el vecino ("Paso 2 de 7"). */
export const NUMERO_PASO: Readonly<Record<IdPaso, number>> = {
  cuenta: 1,
  entrar: 1,
  vivienda: 2,
  mapa: 3,
  avisar: 4,
  consenso: 5,
  estimacion: 6,
  'sin-conexion': 7,
};

export const TOTAL_PASOS = 7;

/**
 * En un paso: la indicación en curso y si ya se completó (`logro`: la tarjeta de "Cuenta creada"
 * antes de pasar al siguiente). `fin` es la pantalla final.
 */
export type EstadoRecorrido =
  { paso: IdPaso; indicacion: number; logro: boolean } | { paso: 'fin' };

export interface ContextoRecorrido {
  hayUsuario: boolean;
  tienePerfil: boolean;
}

/** Lo que el paso necesita saber de su contenido para avanzar. */
export interface FormaPaso {
  indicaciones: number;
  /** Termina con una tarjeta de logro (los pasos en los que el vecino hace algo). */
  conLogro: boolean;
}

/** Pasos que se cumplen con lo que pasa en la app (llega la sesión, se crea el perfil). */
export const cumplido = (paso: IdPaso, ctx: ContextoRecorrido): boolean =>
  paso === 'cuenta' ? ctx.hayUsuario : paso === 'vivienda' ? ctx.tienePerfil : false;

/** Al empezar se salta lo que el vecino ya tiene: quien tiene cuenta no la crea otra vez. */
const hechoAlEmpezar = (paso: IdPaso, ctx: ContextoRecorrido): boolean =>
  paso === 'entrar' ? ctx.hayUsuario : cumplido(paso, ctx);

export function iniciarRecorrido(ctx: ContextoRecorrido): EstadoRecorrido {
  const paso = PASOS_RECORRIDO.find((id) => !hechoAlEmpezar(id, ctx));
  return paso ? { paso, indicacion: 0, logro: false } : { paso: 'fin' };
}

/**
 * El paso que sigue. La vivienda se salta si ya está marcada: pasa si en "Crear tu cuenta" el
 * vecino entró con una cuenta que ya tenía.
 */
export function siguientePasoRecorrido(
  estado: EstadoRecorrido,
  ctx: ContextoRecorrido,
): EstadoRecorrido {
  if (estado.paso === 'fin') return estado;
  const resto = PASOS_RECORRIDO.slice(PASOS_RECORRIDO.indexOf(estado.paso) + 1);
  const paso = resto.find((id) => !(id === 'vivienda' && ctx.tienePerfil));
  return paso ? { paso, indicacion: 0, logro: false } : { paso: 'fin' };
}

/** Termina la indicación en curso: la siguiente, el logro del paso o el paso que sigue. */
export function avanzarRecorrido(
  estado: EstadoRecorrido,
  forma: FormaPaso,
  ctx: ContextoRecorrido,
): EstadoRecorrido {
  if (estado.paso === 'fin' || estado.logro) return estado;
  if (estado.indicacion + 1 < forma.indicaciones) {
    return { ...estado, indicacion: estado.indicacion + 1 };
  }
  return forma.conLogro ? { ...estado, logro: true } : siguientePasoRecorrido(estado, ctx);
}

/** Vuelve a la indicación anterior (corregir el correo, por ejemplo). */
export function retrocederRecorrido(estado: EstadoRecorrido): EstadoRecorrido {
  if (estado.paso === 'fin' || estado.logro || estado.indicacion === 0) return estado;
  return { ...estado, indicacion: estado.indicacion - 1 };
}

/**
 * La app cambió: si el paso en curso ya se cumplió (llegó la sesión aunque el vecino enviara el
 * formulario antes de tiempo), pasa a su logro. Devuelve el mismo objeto si no cambia nada.
 */
export function conContexto(estado: EstadoRecorrido, ctx: ContextoRecorrido): EstadoRecorrido {
  if (estado.paso === 'fin' || estado.logro || !cumplido(estado.paso, ctx)) return estado;
  return { ...estado, logro: true };
}

/**
 * Para la barra de progreso: cuántos de los 7 pasos están hechos y qué parte del que está en
 * curso. El logro de "cuenta" no completa el paso 1: falta "entrar", que lleva su mismo número.
 */
export function progresoRecorrido(
  estado: EstadoRecorrido,
  indicaciones = 1,
): { hechos: number; parcial: number } {
  if (estado.paso === 'fin') return { hechos: TOTAL_PASOS, parcial: 0 };
  const numero = NUMERO_PASO[estado.paso];
  // Los pasos que comparten número se reparten su tramo: "cuenta" la primera mitad del 1.
  const mismos = PASOS_RECORRIDO.filter((id) => NUMERO_PASO[id] === numero);
  const orden = mismos.indexOf(estado.paso);
  if (estado.logro && orden === mismos.length - 1) return { hechos: numero, parcial: 0 };
  const dentro = estado.logro ? 1 : Math.min(1, estado.indicacion / Math.max(1, indicaciones));
  return { hechos: numero - 1, parcial: (orden + dentro) / mismos.length };
}

// Se recuerda en `localStorage`: si el vecino cierra la app a mitad, sigue donde iba.

export const CLAVE_RECORRIDO = 'recorrido';

type AlmacenNavegador = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const esIdPaso = (valor: unknown): valor is IdPaso =>
  typeof valor === 'string' && (PASOS_RECORRIDO as readonly string[]).includes(valor);

export function leerRecorrido(almacen: AlmacenNavegador | undefined): EstadoRecorrido | null {
  try {
    const texto = almacen?.getItem(CLAVE_RECORRIDO);
    if (!texto) return null;
    const dato: unknown = JSON.parse(texto);
    if (typeof dato !== 'object' || dato === null) return null;
    const { paso, indicacion, logro } = dato as Record<string, unknown>;
    if (paso === 'fin') return { paso: 'fin' };
    if (!esIdPaso(paso) || !Number.isInteger(indicacion) || typeof logro !== 'boolean') return null;
    return { paso, indicacion: Math.max(0, indicacion as number), logro };
  } catch {
    return null;
  }
}

function guardarRecorrido(almacen: AlmacenNavegador | undefined, estado: EstadoRecorrido | null) {
  try {
    if (estado) almacen?.setItem(CLAVE_RECORRIDO, JSON.stringify(estado));
    else almacen?.removeItem(CLAVE_RECORRIDO);
  } catch {
    // sin almacenamiento: vale para esta pestaña
  }
}

export interface Recorrido {
  /** `null` cuando no hay recorrido en curso. */
  estado: Observable<EstadoRecorrido | null>;
  fijar(estado: EstadoRecorrido | null): void;
}

export function crearRecorrido(almacen: AlmacenNavegador | undefined): Recorrido {
  const estado = crearAlmacen(leerRecorrido(almacen));
  return {
    estado,
    fijar(nuevo) {
      guardarRecorrido(almacen, nuevo);
      estado.fijar(nuevo);
    },
  };
}
