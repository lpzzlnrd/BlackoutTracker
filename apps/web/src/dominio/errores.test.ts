import { CodigoError } from '@blackout/shared';
import { describe, expect, it } from 'vitest';
import { ErrorApiCliente, mensajeDeError, resolverFallo } from './errores';

describe('resolverFallo: qué hace la cola con cada respuesta (PLAN §5)', () => {
  const resolver = (estado: number, accion: 'inicio' | 'cierre' = 'inicio') =>
    resolverFallo(new ErrorApiCliente(estado), accion);

  it('red caída, 5xx y 429 se reintentan', () => {
    expect(resolver(0)).toBe('reintentar');
    expect(resolver(500)).toBe('reintentar');
    expect(resolver(503)).toBe('reintentar');
    expect(resolver(429)).toBe('reintentar');
  });

  it('un 404 en un cierre se reintenta: el inicio todavía puede estar en camino', () => {
    expect(resolver(404, 'cierre')).toBe('reintentar');
  });

  it('400, 409 y 422 son errores permanentes', () => {
    for (const estado of [400, 409, 422]) expect(resolver(estado)).toBe('permanente');
  });

  it('un 404 en un inicio es permanente', () => {
    expect(resolver(404, 'inicio')).toBe('permanente');
  });

  it('401 pide renovar la sesión', () => {
    expect(resolver(401)).toBe('renovar-sesion');
  });
});

describe('mensajeDeError (datos.md §5)', () => {
  it('un texto en español por cada código de la API, distinto del genérico', () => {
    const genérico = mensajeDeError(CodigoError.ErrorInterno);
    for (const codigo of Object.values(CodigoError)) {
      if (codigo === CodigoError.ErrorInterno) continue;
      expect(mensajeDeError(codigo), codigo).not.toBe(genérico);
    }
  });

  it('REP-05: el mensaje nombra el servicio en el idioma del vecino', () => {
    expect(mensajeDeError(CodigoError.ReporteAbiertoDuplicado, 'electricidad')).toContain('luz');
    expect(mensajeDeError(CodigoError.ReporteAbiertoDuplicado, 'agua')).toContain('agua');
  });

  it('sin código se usa el mensaje genérico', () => {
    expect(mensajeDeError(undefined)).toBe(mensajeDeError(CodigoError.ErrorInterno));
  });
});
