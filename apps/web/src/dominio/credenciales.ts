// Cuenta del residente (Supabase Auth): validación del formulario y traducción de los errores.
// Puro: recibe el error tal cual lo lanza el adaptador y lo lee por su forma, sin importar
// `@supabase/supabase-js`.

export const CLAVE_MINIMA = 6;

export interface ErroresCredenciales {
  correo?: string;
  clave?: string;
}

const FORMATO_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** REG-05: no se envía nada con campos vacíos o mal escritos; se marca cada campo que falla. */
export function validarCredenciales(correo: string, clave: string): ErroresCredenciales {
  const errores: ErroresCredenciales = {};
  const limpio = correo.trim();
  if (!limpio) errores.correo = 'Escribe tu correo.';
  else if (!FORMATO_CORREO.test(limpio)) errores.correo = 'Ese correo no parece válido.';
  if (!clave) errores.clave = 'Escribe tu contraseña.';
  else if (clave.length < CLAVE_MINIMA) {
    errores.clave = `La contraseña debe tener al menos ${CLAVE_MINIMA} caracteres.`;
  }
  return errores;
}

/** Lo que importa de un `AuthError` de Supabase (o de un fallo de red). */
interface ErrorAuthLike {
  name?: unknown;
  code?: unknown;
  status?: unknown;
  message?: unknown;
}

const texto = (valor: unknown): string => (typeof valor === 'string' ? valor : '');

/**
 * La cuenta se creó pero Supabase no dio sesión: pide confirmar el correo ("Confirm email" activo).
 * No es un fallo de Supabase, así que lo marca el adaptador con este código.
 */
export const CONFIRMACION_PENDIENTE = 'confirmacion_pendiente';

export const esConfirmacionPendiente = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  (error as ErrorAuthLike).code === CONFIRMACION_PENDIENTE;

/**
 * Mensaje en español para un fallo de Supabase Auth. Nunca dice cuál de los dos campos falló al
 * entrar (REG-07) y avisa de una cuenta repetida sin crear otra (REG-04).
 */
export function mensajeErrorAuth(error: unknown): string {
  const e = (typeof error === 'object' && error !== null ? error : {}) as ErrorAuthLike;
  const codigo = texto(e.code);
  const mensaje = texto(e.message).toLowerCase();
  const nombre = texto(e.name);
  const estado = typeof e.status === 'number' ? e.status : undefined;

  if (
    nombre === 'AuthRetryableFetchError' ||
    estado === 0 ||
    (error instanceof TypeError && /fetch|network/i.test(error.message)) ||
    mensaje.includes('failed to fetch')
  ) {
    return 'No hay conexión. Para entrar o crear la cuenta necesitas internet.';
  }
  if (codigo === 'invalid_credentials' || mensaje.includes('invalid login credentials')) {
    return 'El correo o la contraseña no son correctos.';
  }
  if (
    codigo === 'user_already_exists' ||
    codigo === 'email_exists' ||
    mensaje.includes('already registered')
  ) {
    return 'Ya existe una cuenta con ese correo. Entra con tu contraseña.';
  }
  if (codigo === 'weak_password' || mensaje.includes('password should be')) {
    return `La contraseña es muy débil. Usa al menos ${CLAVE_MINIMA} caracteres, mejor con letras y números.`;
  }
  if (codigo === 'email_address_invalid' || codigo === 'validation_failed') {
    return 'Ese correo no parece válido.';
  }
  if (codigo.startsWith('over_') || estado === 429) {
    return 'Demasiados intentos seguidos. Espera un momento e inténtalo otra vez.';
  }
  if (codigo === CONFIRMACION_PENDIENTE) {
    return 'Te enviamos un correo para confirmar tu cuenta. Ábrelo y después entra con tu contraseña.';
  }
  if (codigo === 'email_not_confirmed') {
    return 'Tu correo todavía no está confirmado.';
  }
  if (codigo === 'signup_disabled') {
    return 'Ahora mismo no se pueden crear cuentas nuevas.';
  }
  return 'No pudimos completar la operación. Inténtalo de nuevo en un momento.';
}
