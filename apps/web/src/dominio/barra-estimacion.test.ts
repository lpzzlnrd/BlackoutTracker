import { describe, expect, it } from 'vitest';
import { barraEstimacion } from './barra-estimacion';

describe('barraEstimacion (D-038)', () => {
  it('lo que lleva el corte, la mediana y el rango, en % de una escala con holgura', () => {
    // Sector 1 de los datos de ejemplo: mediana 4 h, cuartiles 2 h 30 y 6 h, lleva 46 min.
    expect(
      barraEstimacion({ medianaMin: 240, q1Min: 150, q3Min: 360, transcurridoMin: 46 }),
    ).toEqual({ transcurrido: 10.2, mediana: 53.3, rango: [33.3, 80] });
  });

  it('sin cuartiles no hay rango, y la escala la marca la mediana', () => {
    expect(barraEstimacion({ medianaMin: 200, transcurridoMin: 50 })).toEqual({
      transcurrido: 20,
      mediana: 80,
      rango: null,
    });
  });

  it('un corte más largo que lo habitual estira la escala y no se sale de la barra', () => {
    const barra = barraEstimacion({
      medianaMin: 240,
      q1Min: 150,
      q3Min: 360,
      transcurridoMin: 600,
    });
    expect(barra.transcurrido).toBe(80);
    expect(barra.mediana).toBe(32);
  });
});
