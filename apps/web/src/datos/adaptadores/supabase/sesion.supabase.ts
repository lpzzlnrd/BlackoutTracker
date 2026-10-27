import type { SupabaseClient, User } from '@supabase/supabase-js';
import { crearAlmacen } from '../../../dominio/observable';
import type { UsuarioSesion } from '../../../dominio/tipos';
import type { Sesion } from '../../puertos';

const aUsuario = (usuario: User | null | undefined): UsuarioSesion | null =>
  usuario ? { id: usuario.id, correo: usuario.email ?? '' } : null;

/**
 * Supabase Auth es el único emisor de tokens: Nest solo verifica el JWT. `getSession()` renueva
 * el token vencido por su cuenta, así que `token()` sirve también para el 401 de la cola.
 * Los errores de Auth (correo repetido, clave incorrecta) se propagan tal cual: los formularios
 * de registro e ingreso los traducen (REG-04, REG-07).
 */
export function crearSesionSupabase(supabase: SupabaseClient): Sesion {
  const usuario = crearAlmacen<UsuarioSesion | null>(null);

  supabase.auth.onAuthStateChange((_evento, sesion) => {
    const nuevo = aUsuario(sesion?.user);
    // Evita avisar de lo que no cambió (Supabase emite también al renovar el token).
    if (nuevo?.id !== usuario.leer()?.id) usuario.fijar(nuevo);
  });

  return {
    leer: usuario.leer,
    suscribir: usuario.suscribir,
    async restaurar() {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      usuario.fijar(aUsuario(data.session?.user));
      return usuario.leer();
    },
    async token() {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      return data.session?.access_token ?? null;
    },
    async registrar(correo, clave) {
      const { data, error } = await supabase.auth.signUp({ email: correo, password: clave });
      if (error) throw error;
      const nuevo = aUsuario(data.user);
      if (!nuevo) throw new Error('Supabase no devolvió el usuario creado.');
      return nuevo;
    },
    async iniciar(correo, clave) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: correo,
        password: clave,
      });
      if (error) throw error;
      const nuevo = aUsuario(data.user);
      if (!nuevo) throw new Error('Supabase no devolvió el usuario.');
      return nuevo;
    },
    async cerrar() {
      // 'local': sin red el cierre global falla y deja la sesión puesta; así se cierra igual.
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
    },
  };
}
