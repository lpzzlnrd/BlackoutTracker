import {
  duracionMin,
  leerFecha,
  mensajeHoraInvalida,
  validarCierre,
  validarInicio,
} from './tiempo.puro';

// "ahora" fijo: 7-oct-2026 12:00 (hora del servidor, en UTC). Ningún test usa el reloj real.
const AHORA = new Date('2026-10-07T12:00:00.000Z');
const mas = (base: Date, ms: number) => new Date(base.getTime() + ms);
const MIN = 60_000;
const DIA = 24 * 60 * MIN;

describe('validarInicio', () => {
  it('OFF-03: acepta una hora pasada (se envía a las 12:00 un corte de las 10:30)', () => {
    const inicio = new Date('2026-10-07T10:30:00.000Z');
    expect(validarInicio(inicio, AHORA)).toEqual({ valida: true });
  });

  it('acepta la hora actual', () => {
    expect(validarInicio(AHORA, AHORA)).toEqual({ valida: true });
  });

  it('límite del futuro: exactamente +2 min se acepta y +2 min y 1 ms se rechaza', () => {
    expect(validarInicio(mas(AHORA, 2 * MIN), AHORA)).toEqual({ valida: true });
    expect(validarInicio(mas(AHORA, 2 * MIN + 1), AHORA)).toEqual({
      valida: false,
      motivo: 'FUTURO',
    });
  });

  it('límite del pasado: exactamente 7 días se acepta y 7 días y 1 ms se rechaza', () => {
    expect(validarInicio(mas(AHORA, -7 * DIA), AHORA)).toEqual({ valida: true });
    expect(validarInicio(mas(AHORA, -7 * DIA - 1), AHORA)).toEqual({
      valida: false,
      motivo: 'ANTIGUA',
    });
  });

  it('los límites son configurables', () => {
    const limites = { toleranciaMin: 0, maxAntiguedadDias: 1 };
    expect(validarInicio(mas(AHORA, 1), AHORA, limites)).toEqual({
      valida: false,
      motivo: 'FUTURO',
    });
    expect(validarInicio(mas(AHORA, -DIA - 1), AHORA, limites)).toEqual({
      valida: false,
      motivo: 'ANTIGUA',
    });
  });
});

describe('validarCierre', () => {
  const inicio = new Date('2026-10-07T10:00:00.000Z');

  it('REP-07: un fin anterior al inicio se rechaza', () => {
    expect(validarCierre(mas(inicio, -1), inicio, AHORA)).toEqual({
      valida: false,
      motivo: 'FIN_ANTES_DE_INICIO',
    });
  });

  it('REP-07: un fin igual al inicio (duración cero) se acepta', () => {
    expect(validarCierre(inicio, inicio, AHORA)).toEqual({ valida: true });
  });

  it('REP-03: un fin posterior al inicio se acepta', () => {
    expect(validarCierre(new Date('2026-10-07T11:30:00.000Z'), inicio, AHORA)).toEqual({
      valida: true,
    });
  });

  it('un fin en el futuro se rechaza (con la misma tolerancia de +2 min)', () => {
    expect(validarCierre(mas(AHORA, 2 * MIN), inicio, AHORA)).toEqual({ valida: true });
    expect(validarCierre(mas(AHORA, 2 * MIN + 1), inicio, AHORA)).toEqual({
      valida: false,
      motivo: 'FUTURO',
    });
  });
});

describe('duracionMin y leerFecha', () => {
  it('duracionMin da los minutos entre inicio y fin', () => {
    expect(duracionMin(new Date('2026-10-07T10:00:00Z'), new Date('2026-10-07T12:30:00Z'))).toBe(
      150,
    );
    expect(duracionMin(AHORA, AHORA)).toBe(0);
  });

  it('leerFecha devuelve null para lo que no es una fecha', () => {
    expect(leerFecha('2026-10-07T10:30:00Z')).toEqual(new Date('2026-10-07T10:30:00Z'));
    expect(leerFecha('ayer por la tarde')).toBeNull();
    expect(leerFecha('')).toBeNull();
  });
});

describe('mensajeHoraInvalida', () => {
  it('hay un mensaje en español para cada motivo', () => {
    for (const motivo of ['FECHA_ILEGIBLE', 'FUTURO', 'ANTIGUA', 'FIN_ANTES_DE_INICIO'] as const) {
      expect(mensajeHoraInvalida(motivo)).toMatch(/hora/i);
    }
    expect(mensajeHoraInvalida('ANTIGUA')).toContain('7 días');
  });
});
