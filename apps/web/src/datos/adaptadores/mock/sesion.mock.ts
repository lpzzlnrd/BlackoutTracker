import { crearAlmacen } from '../../../dominio/observable';
import type { UsuarioSesion } from '../../../dominio/tipos';
import type { Sesion } from '../../puertos';

export const USUARIO_DEMO: UsuarioSesion = { id: 'demo-residente', correo: 'vecino@demo.test' };

export interface SesionMock extends Sesion {
  /** Simula que el token venció: el siguiente `token()` renueva solo si `renovable`. */
  vencer(opciones?: { renovable?: boolean }): void;
}

/** Sesión en memoria. Por defecto arranca con el vecino de la demo ya dentro. */
export function crearSesionMock(inicial: UsuarioSesion | null = USUARIO_DEMO): SesionMock {
  const usuario = crearAlmacen<UsuarioSesion | null>(inicial);
  let vencido = false;
  let renovable = true;

  const entrar = (correo: string): UsuarioSesion => {
    const nuevo = { id: `demo-${correo}`, correo };
    vencido = false;
    usuario.fijar(nuevo);
    return nuevo;
  };

  return {
    leer: usuario.leer,
    suscribir: usuario.suscribir,
    restaurar: async () => usuario.leer(),
    async token() {
      if (!usuario.leer()) return null;
      if (vencido) {
        if (!renovable) return null;
        vencido = false;
      }
      return 'token-demo';
    },
    registrar: async (correo) => entrar(correo),
    iniciar: async (correo) => entrar(correo),
    async cerrar() {
      usuario.fijar(null);
    },
    vencer(opciones) {
      vencido = true;
      renovable = opciones?.renovable ?? true;
    },
  };
}
