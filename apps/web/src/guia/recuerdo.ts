import { crearRecuerdoBienvenida } from '../aplicacion/bienvenida';

// Uno por pestaña: lo comparten el modal y la guía (abrir la guía también cuenta como verla). Leer
// `localStorage` puede lanzar (iframes con almacenamiento bloqueado): por eso el try.
const almacenLocal = (): Storage | undefined => {
  try {
    return localStorage;
  } catch {
    return undefined;
  }
};

export const recuerdoBienvenida = crearRecuerdoBienvenida(almacenLocal());
