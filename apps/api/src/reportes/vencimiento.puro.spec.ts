import { haVencido, limiteDeVencimiento } from './vencimiento.puro';

const AHORA = new Date('2026-10-10T12:00:00Z');
const hace = (horas: number) => new Date(AHORA.getTime() - horas * 3_600_000);

describe('vencimiento.puro (T-050, D-015)', () => {
  it('T-050: el límite es ahora menos REPORTE_VENCE_HORAS', () => {
    expect(limiteDeVencimiento(AHORA, 48).toISOString()).toBe('2026-10-08T12:00:00.000Z');
  });

  it('T-050: abierto hace menos de 48 h no vence', () => {
    expect(haVencido({ inicioEn: hace(47.99), finEn: null }, AHORA, 48)).toBe(false);
  });

  it('T-050: el borde exacto (48 h justas) todavía cuenta; un milisegundo más, vence', () => {
    expect(haVencido({ inicioEn: hace(48), finEn: null }, AHORA, 48)).toBe(false);
    expect(haVencido({ inicioEn: new Date(hace(48).getTime() - 1), finEn: null }, AHORA, 48)).toBe(
      true,
    );
  });

  it('T-050: un reporte cerrado nunca vence, por viejo que sea', () => {
    expect(haVencido({ inicioEn: hace(200), finEn: hace(199) }, AHORA, 48)).toBe(false);
  });

  it('T-050: el umbral es configurable', () => {
    expect(haVencido({ inicioEn: hace(5), finEn: null }, AHORA, 4)).toBe(true);
    expect(haVencido({ inicioEn: hace(5), finEn: null }, AHORA, 6)).toBe(false);
  });

  it('T-050: un umbral no positivo o no numérico es un error de configuración', () => {
    expect(() => limiteDeVencimiento(AHORA, 0)).toThrow(RangeError);
    expect(() => limiteDeVencimiento(AHORA, -1)).toThrow(RangeError);
    expect(() => limiteDeVencimiento(AHORA, Number.NaN)).toThrow(RangeError);
  });
});
