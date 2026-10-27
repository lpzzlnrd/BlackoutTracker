import { describe, expect, it } from 'vitest';
import { isoDesdeLocalCaracas, localCaracasDesdeIso, validarHoraAviso } from './hora-aviso';

const AHORA = '2026-10-07T19:06:00.000Z'; // 15:06 en Caracas
const desplazar = (ms: number) => new Date(Date.parse(AHORA) + ms).toISOString();
const MIN = 60_000;
const DIA = 86_400_000;

describe('validarHoraAviso', () => {
  it('OFF-03: una hora pasada dentro del margen se acepta tal cual (la del evento)', () => {
    expect(
      validarHoraAviso({ accion: 'inicio', ocurridoEn: desplazar(-90 * MIN), ahora: AHORA }),
    ).toEqual({ valida: true });
  });

  it('OFF-03: límites del futuro: +2 min se acepta, +2 min y 1 s no', () => {
    expect(
      validarHoraAviso({ accion: 'inicio', ocurridoEn: desplazar(2 * MIN), ahora: AHORA }).valida,
    ).toBe(true);
    expect(
      validarHoraAviso({ accion: 'inicio', ocurridoEn: desplazar(2 * MIN + 1000), ahora: AHORA }),
    ).toEqual({ valida: false, motivo: 'futura' });
  });

  it('OFF-03: límites de antigüedad del inicio: 7 días se acepta, 7 días y 1 min no', () => {
    expect(
      validarHoraAviso({ accion: 'inicio', ocurridoEn: desplazar(-7 * DIA), ahora: AHORA }).valida,
    ).toBe(true);
    expect(
      validarHoraAviso({ accion: 'inicio', ocurridoEn: desplazar(-7 * DIA - MIN), ahora: AHORA }),
    ).toEqual({ valida: false, motivo: 'antigua' });
  });

  it('REP-07: un cierre anterior al inicio se rechaza; igual al inicio se acepta (duración 0)', () => {
    const inicioEn = desplazar(-60 * MIN);
    expect(
      validarHoraAviso({
        accion: 'cierre',
        ocurridoEn: desplazar(-61 * MIN),
        ahora: AHORA,
        inicioEn,
      }),
    ).toEqual({ valida: false, motivo: 'antes-del-inicio' });
    expect(
      validarHoraAviso({ accion: 'cierre', ocurridoEn: inicioEn, ahora: AHORA, inicioEn }).valida,
    ).toBe(true);
  });

  it('REP-07: el cierre tampoco puede ser futuro', () => {
    expect(
      validarHoraAviso({
        accion: 'cierre',
        ocurridoEn: desplazar(10 * MIN),
        ahora: AHORA,
        inicioEn: desplazar(-60 * MIN),
      }),
    ).toEqual({ valida: false, motivo: 'futura' });
  });

  it('una fecha ilegible no se encola', () => {
    expect(validarHoraAviso({ accion: 'inicio', ocurridoEn: 'ayer', ahora: AHORA })).toEqual({
      valida: false,
      motivo: 'ilegible',
    });
  });
});

describe('hora de Caracas en el datetime-local', () => {
  it('OFF-03: "14:20" en Caracas es 18:20 UTC, sin importar la zona del teléfono', () => {
    expect(isoDesdeLocalCaracas('2026-10-07T14:20')).toBe('2026-10-07T18:20:00.000Z');
  });

  it('ida y vuelta', () => {
    expect(localCaracasDesdeIso(AHORA)).toBe('2026-10-07T15:06');
    expect(isoDesdeLocalCaracas(localCaracasDesdeIso(AHORA))).toBe(AHORA);
  });

  it('cruza la medianoche hacia el día anterior', () => {
    expect(localCaracasDesdeIso('2026-10-08T02:30:00Z')).toBe('2026-10-07T22:30');
  });

  it('un valor incompleto devuelve null', () => {
    expect(isoDesdeLocalCaracas('')).toBeNull();
    expect(isoDesdeLocalCaracas('2026-10-07')).toBeNull();
  });
});
