import { crearAlmacen, type Observable } from '../dominio/observable';
import type { Ruta } from '../navegacion/ruta';

// La bienvenida de la primera visita (T-071, D-041): el modal "¿Nuevo en BlackoutTracker?" sale
// una sola vez por dispositivo, y solo a quien entra sin sesión, porque quien ya tiene cuenta no es
// nuevo. Se recuerda en `localStorage`, que puede no existir (modo privado): entonces se recuerda
// solo mientras la pestaña siga abierta, como las preferencias.

export const CLAVE_BIENVENIDA = 'bienvenida-vista';

type AlmacenNavegador = Pick<Storage, 'getItem' | 'setItem'>;

export function leerVista(almacen: AlmacenNavegador | undefined): boolean {
  try {
    return almacen?.getItem(CLAVE_BIENVENIDA) === '1';
  } catch {
    return false;
  }
}

export function guardarVista(almacen: AlmacenNavegador | undefined): void {
  try {
    almacen?.setItem(CLAVE_BIENVENIDA, '1');
  } catch {
    // sin almacenamiento: vale para esta pestaña
  }
}

/**
 * Sale sin sesión, si no se vio antes y fuera de la guía. Si la sesión llega tarde (sin red,
 * `main.tsx` pinta a los 2 s), el modal se cierra solo y no queda como visto.
 */
export const mostrarBienvenida = ({
  hayUsuario,
  vista,
  ruta,
}: {
  hayUsuario: boolean;
  vista: boolean;
  ruta: Ruta;
}): boolean => !hayUsuario && !vista && ruta !== '/guia';

export interface RecuerdoBienvenida {
  vista: Observable<boolean>;
  /** "Ahora no", "Ver la guía", Escape o abrir la guía por cualquier camino. */
  marcar(): void;
}

export function crearRecuerdoBienvenida(almacen: AlmacenNavegador | undefined): RecuerdoBienvenida {
  const vista = crearAlmacen(leerVista(almacen));
  return {
    vista,
    marcar() {
      guardarVista(almacen);
      vista.fijar(true);
    },
  };
}

/** Lo que le toca al vecino según lo que ya hizo: el botón final de la guía. */
export type SiguientePaso = 'crear-cuenta' | 'marcar-vivienda' | 'reportar';

export const siguientePaso = ({
  hayUsuario,
  tienePerfil,
}: {
  hayUsuario: boolean;
  tienePerfil: boolean;
}): SiguientePaso => (!hayUsuario ? 'crear-cuenta' : tienePerfil ? 'reportar' : 'marcar-vivienda');
