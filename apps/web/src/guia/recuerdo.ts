import { crearRecuerdoBienvenida } from '../aplicacion/bienvenida';
import { crearRecorrido } from '../aplicacion/recorrido';

// Uno por pestaña: los comparten el modal, el recorrido y la guía (abrir la guía también cuenta
// como ver la bienvenida). Leer `localStorage` puede lanzar (iframes con almacenamiento bloqueado):
// por eso el try.
const almacenLocal = (): Storage | undefined => {
  try {
    return localStorage;
  } catch {
    return undefined;
  }
};

export const recuerdoBienvenida = crearRecuerdoBienvenida(almacenLocal());

/** El recorrido guiado en curso (T-073, D-043): sobrevive a cerrar la app. */
export const recorrido = crearRecorrido(almacenLocal());
