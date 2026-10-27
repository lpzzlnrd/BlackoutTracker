import { describe, expect, it } from 'vitest';
import {
  diaRelativo,
  duracion,
  estimacionAprox,
  hora,
  nombreServicio,
  segunCortes,
} from './formato';

// Las cadenas esperadas son las de las referencias (CANON §7.1, datos-ejemplo.json).
const AHORA = '2026-10-07T19:06:00Z';

describe('formato (CANON §7.1)', () => {
  it('hora: 24 h en la zona de Caracas (UTC−4)', () => {
    expect(hora(AHORA)).toBe('15:06');
    expect(hora('2026-10-07T18:32:00Z')).toBe('14:32');
    expect(hora('2026-10-07T04:00:00Z')).toBe('00:00');
  });

  it('duracion: minutos enteros, sin ceros sobrantes', () => {
    expect(duracion(45)).toBe('45 min');
    expect(duracion(240)).toBe('4 h');
    expect(duracion(220)).toBe('3 h 40 min');
    expect(duracion(305)).toBe('5 h 5 min');
  });

  it('diaRelativo: por día calendario de Caracas', () => {
    expect(diaRelativo('2026-10-07T18:20:00Z', AHORA)).toBe('Hoy');
    expect(diaRelativo('2026-10-06T19:00:00Z', AHORA)).toBe('Ayer');
    expect(diaRelativo('2026-10-04T22:05:00Z', AHORA)).toBe('Hace 3 días');
    // 00:30 UTC del 8 es todavía el 7 en Caracas: sigue siendo "Hoy".
    expect(diaRelativo('2026-10-08T00:30:00Z', '2026-10-08T01:00:00Z')).toBe('Hoy');
  });

  it('EST-04: la estimación va siempre con "aprox." y su n, en singular o plural', () => {
    expect(estimacionAprox(240)).toBe('aprox. 4 h');
    expect(segunCortes(12)).toBe('según 12 cortes registrados');
    expect(segunCortes(1)).toBe('según 1 corte registrado');
  });

  it('nombres de servicio', () => {
    expect(nombreServicio('electricidad')).toBe('Luz');
    expect(nombreServicio('agua')).toBe('Agua');
  });
});
