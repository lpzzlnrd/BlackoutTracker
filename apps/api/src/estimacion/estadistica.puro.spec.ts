import { ESTIMACION_N_MIN_POR_DEFECTO } from '@blackout/shared';
import { cuartiles, mediana, resumir, type DatosEstimacion } from './estadistica.puro';

const datosDe = (duraciones: number[]): DatosEstimacion => {
  const c = cuartiles(duraciones);
  return {
    n: duraciones.length,
    mediana: mediana(duraciones),
    q1: c?.q1 ?? null,
    q3: c?.q3 ?? null,
  };
};

describe('mediana', () => {
  it('EST-01: con una cantidad impar es el valor central', () => {
    expect(mediana([240, 60, 120])).toBe(120);
  });

  it('EST-02: con una cantidad par promedia los dos centrales', () => {
    expect(mediana([100, 20, 60, 40])).toBe(50);
  });

  it('EST-03: un corte de 30 h no mueve la estimación como lo haría el promedio', () => {
    const minutos = [120, 150, 180, 200, 30 * 60];
    expect(mediana(minutos)).toBe(180);
    expect(minutos.reduce((a, b) => a + b, 0) / minutos.length).toBeGreaterThan(400);
  });

  it('con un solo dato es ese dato, y sin datos es null (sin umbral)', () => {
    expect(mediana([75])).toBe(75);
    expect(mediana([])).toBeNull();
  });

  it('no modifica el arreglo que recibe', () => {
    const entrada = [3, 1, 2];
    mediana(entrada);
    expect(entrada).toEqual([3, 1, 2]);
  });

  it('rechaza valores que no son números finitos', () => {
    expect(() => mediana([1, Number.NaN])).toThrow(RangeError);
    expect(() => mediana([1, Infinity])).toThrow(RangeError);
  });
});

describe('cuartiles', () => {
  it('interpola como percentile_cont', () => {
    expect(cuartiles([1, 2, 3, 4, 5])).toEqual({ q1: 2, q3: 4 });
    expect(cuartiles([1, 2, 3, 4])).toEqual({ q1: 1.75, q3: 3.25 });
  });

  it('con un solo dato ambos cuartiles son ese dato', () => {
    expect(cuartiles([9])).toEqual({ q1: 9, q3: 9 });
  });

  it('sin datos es null', () => {
    expect(cuartiles([])).toBeNull();
  });
});

describe('resumir', () => {
  it('EST-04: con n = 0 no hay cifra', () => {
    expect(resumir(datosDe([]), 5)).toEqual({ suficiente: false, n: 0 });
  });

  it('EST-04: con n = n_min − 1 no hay cifra, solo el n', () => {
    expect(resumir(datosDe([10, 20, 30, 40]), 5)).toEqual({ suficiente: false, n: 4 });
  });

  it('EST-04: con n = n_min hay cifra junto con su n y el rango intercuartílico', () => {
    expect(resumir(datosDe([10, 20, 30, 40, 50]), 5)).toEqual({
      suficiente: true,
      n: 5,
      medianaMin: 30,
      q1Min: 20,
      q3Min: 40,
    });
  });

  it('usa n_min = 5 por defecto', () => {
    expect(ESTIMACION_N_MIN_POR_DEFECTO).toBe(5);
    expect(resumir(datosDe([1, 2, 3, 4]))).toEqual({ suficiente: false, n: 4 });
    expect(resumir(datosDe([1, 2, 3, 4, 5])).suficiente).toBe(true);
  });

  it('n_min es configurable', () => {
    expect(resumir(datosDe([10, 20, 30]), 3).suficiente).toBe(true);
    expect(resumir(datosDe([10, 20, 30]), 4).suficiente).toBe(false);
  });

  it('omite los cuartiles si no vienen', () => {
    expect(resumir({ n: 6, mediana: 90, q1: null, q3: null }, 5)).toEqual({
      suficiente: true,
      n: 6,
      medianaMin: 90,
    });
  });

  it('sin mediana no hay cifra aunque n alcance', () => {
    expect(resumir({ n: 6, mediana: null, q1: null, q3: null }, 5)).toEqual({
      suficiente: false,
      n: 6,
    });
  });

  it('rechaza un n_min que no es un entero ≥ 1', () => {
    expect(() => resumir(datosDe([1]), 0)).toThrow(RangeError);
    expect(() => resumir(datosDe([1]), 2.5)).toThrow(RangeError);
  });
});
