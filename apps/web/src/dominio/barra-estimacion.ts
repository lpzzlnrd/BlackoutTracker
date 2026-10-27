// Geometría de la barra de la estimación (D-038): lo que lleva el corte en curso frente a la
// mediana y, si la API los da, los cuartiles (el "rango habitual"). Función pura: se prueba sin
// React. Es una ayuda visual de la estimación estadística, no una predicción de la hora de vuelta.

export interface BarraEstimacion {
  /** Porcentajes del ancho, de 0 a 100. */
  transcurrido: number;
  mediana: number;
  /** Del primer al tercer cuartil; nulo si la API no los manda. */
  rango: readonly [number, number] | null;
}

/** La escala llega un 25 % más allá del mayor valor: la mediana nunca queda pegada al borde. */
const HOLGURA = 1.25;

const porcentaje = (minutos: number, tope: number): number =>
  Math.round((Math.min(minutos, tope) / tope) * 1000) / 10;

export function barraEstimacion(opciones: {
  medianaMin: number;
  q1Min?: number;
  q3Min?: number;
  transcurridoMin: number;
}): BarraEstimacion {
  const { medianaMin, q1Min, q3Min, transcurridoMin } = opciones;
  const tope = Math.max(medianaMin, q3Min ?? 0, transcurridoMin, 1) * HOLGURA;
  return {
    transcurrido: porcentaje(Math.max(0, transcurridoMin), tope),
    mediana: porcentaje(medianaMin, tope),
    rango:
      q1Min !== undefined && q3Min !== undefined
        ? [porcentaje(q1Min, tope), porcentaje(q3Min, tope)]
        : null,
  };
}
