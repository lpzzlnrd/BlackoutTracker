import type { Observable } from '../../dominio/observable';
import type { UsuarioSesion } from '../../dominio/tipos';

/** Autenticación del residente. El front usa Supabase Auth; Nest solo verifica el JWT. */
export interface Sesion extends Observable<UsuarioSesion | null> {
  /** Recupera la sesión guardada al abrir la app; deja el valor de `leer()` al día. */
  restaurar(): Promise<UsuarioSesion | null>;
  /** JWT vigente para la API, o `null` sin sesión. Renueva si hace falta (401 de la cola). */
  token(): Promise<string | null>;
  registrar(correo: string, clave: string): Promise<UsuarioSesion>;
  iniciar(correo: string, clave: string): Promise<UsuarioSesion>;
  /** Cierra la sesión y vacía lo que depende del usuario (cola, cachés): lo hace quien orquesta. */
  cerrar(): Promise<void>;
}
