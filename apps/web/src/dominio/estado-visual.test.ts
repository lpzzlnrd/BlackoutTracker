import { describe, expect, it } from 'vitest';
import { estadoVisual, peorEstado } from './estado-visual';
import type { EstadoSector } from './tipos';

const fila = (parche: Partial<EstadoSector>): EstadoSector => ({
  sectorId: 1,
  tipoServicio: 'electricidad',
  estado: 'con_servicio',
  reportesSinConfirmar: 0,
  desde: null,
  actualizadoEn: '2026-10-07T19:06:00Z',
  ...parche,
});

describe('estadoVisual (CANON §3)', () => {
  it('sin fila no hay datos: lo decide el cliente', () => {
    expect(estadoVisual(undefined)).toBe('sin-datos');
  });

  it('con servicio y sin reportes pendientes', () => {
    expect(estadoVisual(fila({}))).toBe('con-servicio');
  });

  it('CON-02: con servicio pero con reportes sin confirmar', () => {
    expect(estadoVisual(fila({ reportesSinConfirmar: 2 }))).toBe('sin-confirmar');
  });

  it('sin servicio gana aunque haya reportes sin confirmar', () => {
    expect(estadoVisual(fila({ estado: 'sin_servicio', reportesSinConfirmar: 2 }))).toBe(
      'sin-servicio',
    );
  });

  it('peorEstado de un sector con dos servicios: sin servicio > sin confirmar > con servicio', () => {
    const agua = fila({ tipoServicio: 'agua' });
    expect(peorEstado([agua, fila({ reportesSinConfirmar: 1 })])).toBe('sin-confirmar');
    expect(peorEstado([agua, fila({ estado: 'sin_servicio' })])).toBe('sin-servicio');
    expect(peorEstado([])).toBe('sin-datos');
  });
});
