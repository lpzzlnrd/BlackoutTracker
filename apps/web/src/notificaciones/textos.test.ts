import { describe, expect, it } from 'vitest';
import type { EstadoSector } from '../dominio/tipos';
import {
  TEXTO_SILENCIO,
  textoCambioSector,
  textoEstadoPush,
  textoResultadoActivar,
} from './textos';

const fila = (cambios: Partial<EstadoSector>): EstadoSector => ({
  sectorId: 7,
  tipoServicio: 'electricidad',
  estado: 'con_servicio',
  reportesSinConfirmar: 0,
  desde: null,
  actualizadoEn: '2026-11-03T18:00:00Z',
  ...cambios,
});

describe('aviso dentro de la app cuando cambia tu sector (T-072)', () => {
  it('NOT-23: se fue la luz, confirmado por los vecinos', () => {
    expect(textoCambioSector(fila({}), fila({ estado: 'sin_servicio' }), 'Guaparo')).toBe(
      'Se fue la luz en Guaparo: tus vecinos lo confirmaron.',
    );
  });

  it('NOT-23: volvió la luz; llegó el agua, con los tobos (voz B)', () => {
    expect(textoCambioSector(fila({ estado: 'sin_servicio' }), fila({}), 'Guaparo')).toBe(
      '¡Volvió la luz a Guaparo!',
    );
    const agua = { tipoServicio: 'agua' as const };
    expect(
      textoCambioSector(fila({ ...agua, estado: 'sin_servicio' }), fila(agua), 'Guaparo'),
    ).toBe('¡Llegó el agua a Guaparo! Aprovecha y llena los tobos.');
  });

  it('NOT-23: los reportes sin confirmar no interrumpen', () => {
    expect(textoCambioSector(fila({}), fila({ reportesSinConfirmar: 2 }), 'Guaparo')).toBeNull();
    expect(textoCambioSector(undefined, fila({}), 'Guaparo')).toBeNull();
  });
});

describe('textos de Cuenta (T-072)', () => {
  it('NOT-20: explica qué hacer en cada caso; si se puede activar, no hay nada que explicar', () => {
    expect(textoEstadoPush('pendiente', true)).toBeNull();
    expect(textoEstadoPush('concedido', true)).toBeNull();
    expect(textoEstadoPush('pendiente', false)).toMatch(/todavía no están disponibles/);
    expect(textoEstadoPush('requiere-instalar', true)).toMatch(/Añadir a pantalla de inicio/);
    expect(textoEstadoPush('denegado', true)).toMatch(/ajustes del navegador/);
    expect(textoEstadoPush('no-soportado', true)).toMatch(/no puede recibir/);
  });

  it('NOT-04: las horas silenciosas son de 22:00 a 07:00 (D-042)', () => {
    expect(TEXTO_SILENCIO).toContain('22:00');
    expect(TEXTO_SILENCIO).toContain('07:00');
  });

  it('NOT-12: nunca se habla de predicción', () => {
    const todos = [
      TEXTO_SILENCIO,
      ...(['activadas', 'denegado', 'inactivo', 'no-soportado'] as const).map(
        textoResultadoActivar,
      ),
      ...(['no-soportado', 'requiere-instalar', 'denegado'] as const).map((e) =>
        String(textoEstadoPush(e, true)),
      ),
    ];
    for (const texto of todos) expect(texto.toLowerCase()).not.toMatch(/predic/);
  });
});
