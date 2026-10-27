// Estadística de la estimación. Lógica pura: no importa Nest ni Drizzle (docs/PLAN.md §6.4).
// Es una estimación estadística (un estimador de tendencia central), no una predicción.
import { ESTIMACION_N_MIN_POR_DEFECTO, type EstimacionDto } from '@blackout/shared';

export interface Cuartiles {
  q1: number;
  q3: number;
}

/** Datos ya agregados de un (sector, servicio), en minutos. Es la forma de la consulta SQL. */
export interface DatosEstimacion {
  /** Cortes cerrados que entran en el cálculo. */
  n: number;
  mediana: number | null;
  q1: number | null;
  q3: number | null;
}

function ordenar(xs: readonly number[]): number[] {
  if (xs.some((x) => !Number.isFinite(x))) {
    throw new RangeError('Las duraciones deben ser números finitos');
  }
  return [...xs].sort((a, b) => a - b);
}

/** Percentil `p` (0 a 1) de una muestra ordenada, con interpolación lineal: igual que `percentile_cont`. */
function percentil(ordenados: readonly number[], p: number): number {
  const pos = (ordenados.length - 1) * p;
  const abajo = Math.floor(pos);
  const arriba = Math.ceil(pos);
  return ordenados[abajo] + (ordenados[arriba] - ordenados[abajo]) * (pos - abajo);
}

/**
 * Mediana de las duraciones (EST-01 a EST-03). Con una cantidad par promedia los dos centrales
 * (EST-02). No aplica el umbral n_min: eso es de `resumir`. `null` si no hay datos.
 */
export function mediana(duraciones: readonly number[]): number | null {
  if (duraciones.length === 0) return null;
  return percentil(ordenar(duraciones), 0.5);
}

/** Primer y tercer cuartil, con el mismo método que la mediana. `null` si no hay datos. */
export function cuartiles(duraciones: readonly number[]): Cuartiles | null {
  if (duraciones.length === 0) return null;
  const ordenados = ordenar(duraciones);
  return { q1: percentil(ordenados, 0.25), q3: percentil(ordenados, 0.75) };
}

/**
 * Arma la respuesta de `GET /estimaciones`. Con `n < nMin` no hay cifra, solo el n (EST-04); si no,
 * la cifra siempre va con su n.
 */
export function resumir(
  datos: DatosEstimacion,
  nMin: number = ESTIMACION_N_MIN_POR_DEFECTO,
): EstimacionDto {
  if (!Number.isInteger(nMin) || nMin < 1) {
    throw new RangeError('nMin debe ser un entero ≥ 1');
  }
  if (datos.n < nMin || datos.mediana === null) {
    return { suficiente: false, n: datos.n };
  }
  return {
    suficiente: true,
    n: datos.n,
    medianaMin: datos.mediana,
    ...(datos.q1 !== null && datos.q3 !== null ? { q1Min: datos.q1, q3Min: datos.q3 } : {}),
  };
}
