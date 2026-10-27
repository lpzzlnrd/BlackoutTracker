import { TipoServicio } from '@blackout/shared';
import { describe, expect, it } from 'vitest';
import { resumenCola, textoSinEnviar } from './aviso';
import type { AvisoCola, EstadoAviso } from './tipos';

const aviso = (estado: EstadoAviso, n: number): AvisoCola => ({
  id: `aviso-${n}`,
  reporteId: `reporte-${n}`,
  tipoServicio: TipoServicio.Electricidad,
  accion: 'inicio',
  ocurridoEn: '2026-10-07T19:04:00Z',
  estado,
});

describe('resumenCola', () => {
  it('OFF-01: la insignia cuenta lo que no llegó al servidor (pendientes y rechazados)', () => {
    const cola = [aviso('enviado', 1), aviso('pendiente', 2), aviso('error', 3)];
    expect(resumenCola(cola)).toEqual({ sinEnviar: 2, conError: true });
  });

  it('OFF-01: sin errores se pinta como pendiente; sin cola, no hay insignia', () => {
    expect(resumenCola([aviso('pendiente', 1)])).toEqual({ sinEnviar: 1, conError: false });
    expect(resumenCola([aviso('enviado', 1)])).toEqual({ sinEnviar: 0, conError: false });
    expect(resumenCola(undefined)).toEqual({ sinEnviar: 0, conError: false });
  });
});

describe('textoSinEnviar', () => {
  it('CANON §7: singular y plural', () => {
    expect(textoSinEnviar(1)).toBe('1 aviso sin enviar');
    expect(textoSinEnviar(3)).toBe('3 avisos sin enviar');
  });
});
