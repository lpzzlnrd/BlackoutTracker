// Consenso de inicio de un corte (docs/PLAN.md §6.1). Lógica pura: no importa Nest ni Drizzle y
// NUNCA llama a `Date.now()`; recibe `ahora` como parámetro, así los tests fijan el reloj.
// Los reportes que recibe ya son de un solo (sector, servicio): los sectores y los servicios
// nunca se mezclan porque la consulta los filtra antes (CON-05, EST-05).

const MS_MINUTO = 60_000;

/** Un reporte abierto y no vencido de un (sector, servicio). */
export interface ReporteAbierto {
  residenteId: string;
  inicioEn: Date;
}

export interface ParametrosInicio {
  /** N: residentes distintos que deben coincidir (CONSENSO_N). */
  n: number;
  /** W: ancho de la ventana, en minutos, del servicio. */
  ventanaMin: number;
  /** Hora del servidor; solo sirve para la ventana más reciente de `sinConfirmar`. */
  ahora: Date;
}

export interface ResultadoInicio {
  confirmado: boolean;
  /** Mediana de las horas de los N primeros residentes de la ventana ganadora; `null` si no hay consenso. */
  inicioEvento: Date | null;
  /**
   * Residentes distintos en la ventana más reciente que termina en `ahora`, mientras todavía no hay
   * consenso (CON-01: «reportes sin confirmar»). Con consenso es 0: ya no están sin confirmar.
   */
  sinConfirmar: number;
}

/**
 * Un reporte por residente, el más antiguo (CON-04: varios reportes del mismo usuario cuentan como
 * uno), ordenados por hora de inicio. Con la misma hora, el orden de entrada no importa: el
 * resultado solo usa las horas.
 */
function unoPorResidente(reportes: readonly ReporteAbierto[]): ReporteAbierto[] {
  const masAntiguo = new Map<string, ReporteAbierto>();
  for (const reporte of reportes) {
    const previo = masAntiguo.get(reporte.residenteId);
    if (!previo || reporte.inicioEn.getTime() < previo.inicioEn.getTime()) {
      masAntiguo.set(reporte.residenteId, reporte);
    }
  }
  return [...masAntiguo.values()].sort((a, b) => a.inicioEn.getTime() - b.inicioEn.getTime());
}

/**
 * Mediana de unas horas (D-007): un reloj manipulado o un vecino que reporta tarde no mueven la
 * hora del evento. Con una cantidad par se promedian los dos centrales.
 */
export function medianaDeHoras(horas: readonly Date[]): Date {
  const ms = horas.map((h) => h.getTime()).sort((a, b) => a - b);
  const medio = Math.floor(ms.length / 2);
  const valor = ms.length % 2 === 1 ? ms[medio] : (ms[medio - 1] + ms[medio]) / 2;
  return new Date(Math.round(valor));
}

/**
 * Decide si un (sector, servicio) tiene un corte confirmado. Recorre los reportes ordenados con una
 * ventana deslizante de ancho `W`; si en alguna hay N residentes distintos, hay consenso. Los
 * límites son inclusivos: dos reportes separados exactamente por `W` caben en la misma ventana y
 * uno más allá por 1 ms no (CON-07). Se toma la primera ventana ganadora en el tiempo.
 */
export function evaluarInicio(
  reportes: readonly ReporteAbierto[],
  { n, ventanaMin, ahora }: ParametrosInicio,
): ResultadoInicio {
  if (!Number.isInteger(n) || n < 1) throw new RangeError('N debe ser un entero mayor o igual a 1');
  const ventanaMs = ventanaMin * MS_MINUTO;
  const unicos = unoPorResidente(reportes);

  for (let i = 0; i + n <= unicos.length; i++) {
    const ultimo = unicos[i + n - 1];
    if (ultimo.inicioEn.getTime() - unicos[i].inicioEn.getTime() <= ventanaMs) {
      const primerosN = unicos.slice(i, i + n).map((r) => r.inicioEn);
      return { confirmado: true, inicioEvento: medianaDeHoras(primerosN), sinConfirmar: 0 };
    }
  }

  const desde = ahora.getTime() - ventanaMs;
  const recientes = unicos.filter((r) => r.inicioEn.getTime() >= desde).length;
  return { confirmado: false, inicioEvento: null, sinConfirmar: recientes };
}
