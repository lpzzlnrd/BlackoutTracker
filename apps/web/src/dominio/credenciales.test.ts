import { describe, expect, it } from 'vitest';
import {
  CONFIRMACION_PENDIENTE,
  esConfirmacionPendiente,
  mensajeErrorAuth,
  validarCredenciales,
} from './credenciales';

describe('validarCredenciales', () => {
  it('REG-05: sin correo ni contraseña no se envía y se marca cada campo', () => {
    expect(validarCredenciales('', '')).toEqual({
      correo: 'Escribe tu correo.',
      clave: 'Escribe tu contraseña.',
    });
  });

  it('REG-05: un correo mal escrito o una contraseña corta se marcan por separado', () => {
    expect(validarCredenciales('vecino@', '123456')).toEqual({
      correo: 'Ese correo no parece válido.',
    });
    expect(validarCredenciales('vecino@guaparo.ve', '12345').clave).toMatch(/al menos 6/);
  });

  it('REG-05: con datos válidos no hay errores (los espacios del correo no cuentan)', () => {
    expect(validarCredenciales('  vecino@guaparo.ve ', '123456')).toEqual({});
  });
});

describe('mensajeErrorAuth', () => {
  it('REG-07: credenciales incorrectas, sin decir qué campo falló', () => {
    const mensaje = mensajeErrorAuth({ code: 'invalid_credentials', status: 400 });
    expect(mensaje).toBe('El correo o la contraseña no son correctos.');
    expect(mensajeErrorAuth({ message: 'Invalid login credentials' })).toBe(mensaje);
  });

  it('REG-04: un correo ya registrado avisa de la cuenta existente', () => {
    expect(mensajeErrorAuth({ code: 'user_already_exists', status: 422 })).toMatch(
      /Ya existe una cuenta con ese correo/,
    );
    expect(mensajeErrorAuth({ message: 'User already registered' })).toMatch(/Ya existe/);
  });

  it('REG-05: contraseña débil y demasiados intentos', () => {
    expect(mensajeErrorAuth({ code: 'weak_password' })).toMatch(/muy débil/);
    expect(mensajeErrorAuth({ code: 'over_request_rate_limit', status: 429 })).toMatch(
      /Demasiados intentos/,
    );
  });

  it('OFF-07: sin red lo dice en claro', () => {
    expect(mensajeErrorAuth({ name: 'AuthRetryableFetchError', status: 0 })).toMatch(
      /No hay conexión/,
    );
    expect(mensajeErrorAuth(new TypeError('Failed to fetch'))).toMatch(/No hay conexión/);
  });

  it('REG-07: cualquier otro error da un mensaje genérico, nunca el del servidor', () => {
    expect(mensajeErrorAuth({ message: 'Database error saving new user' })).toBe(
      'No pudimos completar la operación. Inténtalo de nuevo en un momento.',
    );
    expect(mensajeErrorAuth(null)).toMatch(/No pudimos/);
  });
});

describe('confirmación de correo pendiente', () => {
  it('REG-01: si Supabase pide confirmar el correo, se dice en claro en vez de quedarse sin sesión', () => {
    const error = Object.assign(new Error('x'), { code: CONFIRMACION_PENDIENTE });
    expect(esConfirmacionPendiente(error)).toBe(true);
    expect(mensajeErrorAuth(error)).toMatch(/Te enviamos un correo/);
    expect(esConfirmacionPendiente({ code: 'email_not_confirmed' })).toBe(false);
    expect(esConfirmacionPendiente(null)).toBe(false);
  });
});
