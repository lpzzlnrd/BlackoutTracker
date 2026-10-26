// Consenso de inicio (docs/PLAN.md §6.1) y de restablecimiento (§6.2) de un corte. Lógica pura: no importa Nest ni Drizzle y
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

/** Una hora atribuida a un residente: el inicio o el fin de uno de sus reportes. */
interface Marca {
  residenteId: string;
  hora: Date;
}

/**
 * Una marca por residente, la más antigua (CON-04: varios reportes del mismo usuario cuentan como
 * uno), ordenadas por hora. Con la misma hora, el orden de entrada no importa: el resultado solo
 * usa las horas.
 */
function unoPorResidente(marcas: readonly Marca[]): Marca[] {
  const masAntigua = new Map<string, Marca>();
  for (const marca of marcas) {
    const previa = masAntigua.get(marca.residenteId);
    if (!previa || marca.hora.getTime() < previa.hora.getTime()) {
      masAntigua.set(marca.residenteId, marca);
    }
  }
  return [...masAntigua.values()].sort((a, b) => a.hora.getTime() - b.hora.getTime());
}

/**
 * Las horas de los N primeros residentes de la primera ventana de ancho `ventanaMs` que reúne N
 * residentes distintos, o `null` si ninguna lo logra. Los límites son inclusivos: dos marcas
 * separadas exactamente por `ventanaMs` caben en la misma ventana y una más allá por 1 ms no
 * (CON-07). Recibe las marcas ya deduplicadas y ordenadas.
 */
function primeraVentana(unicas: readonly Marca[], n: number, ventanaMs: number): Date[] | null {
  for (let i = 0; i + n <= unicas.length; i++) {
    if (unicas[i + n - 1].hora.getTime() - unicas[i].hora.getTime() <= ventanaMs) {
      return unicas.slice(i, i + n).map((m) => m.hora);
    }
  }
  return null;
}

function validarN(n: number): void {
  if (!Number.isInteger(n) || n < 1) throw new RangeError('N debe ser un entero mayor o igual a 1');
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
 * ventana deslizante de ancho `W`; si en alguna hay N residentes distintos, hay consenso (CON-07:
 * los límites son inclusivos). Se toma la primera ventana ganadora en el tiempo.
 */
export function evaluarInicio(
  reportes: readonly ReporteAbierto[],
  { n, ventanaMin, ahora }: ParametrosInicio,
): ResultadoInicio {
  validarN(n);
  const ventanaMs = ventanaMin * MS_MINUTO;
  const unicas = unoPorResidente(
    reportes.map((r) => ({ residenteId: r.residenteId, hora: r.inicioEn })),
  );

  const ganadora = primeraVentana(unicas, n, ventanaMs);
  if (ganadora)
    return { confirmado: true, inicioEvento: medianaDeHoras(ganadora), sinConfirmar: 0 };

  const desde = ahora.getTime() - ventanaMs;
  const recientes = unicas.filter((m) => m.hora.getTime() >= desde).length;
  return { confirmado: false, inicioEvento: null, sinConfirmar: recientes };
}

/** Un reporte cerrado de un (sector, servicio): el residente dijo que el servicio volvió. */
export interface ReporteCerrado {
  residenteId: string;
  finEn: Date;
}

export interface ParametrosRestablecimiento {
  /** N: residentes distintos que deben coincidir (CONSENSO_N). */
  n: number;
  /** W: ancho de la ventana, en minutos, del servicio. */
  ventanaMin: number;
  /** Hora de inicio del evento abierto: los cierres anteriores a ella no pertenecen a este corte. */
  inicioEvento: Date;
  /**
   * Reportes que siguen abiertos y sin vencer en el (sector, servicio): quienes aún no dicen que
   * volvió. Los vencidos no cuentan (D-015).
   */
  reportesAbiertos: number;
}

export type MotivoCierre = 'consenso' | 'sin_abiertos' | 'incompleto';

export interface ResultadoRestablecimiento {
  cerrado: boolean;
  /**
   * Mediana de los `fin_en` que dispararon el cierre (CON-06, D-007); `null` si el evento sigue
   * abierto o si se cerró como incompleto (nadie dijo cuándo volvió).
   */
  finEvento: Date | null;
  /**
   * Por qué se cerró: N cierres en una ventana, ya no queda ningún reporte abierto, o todos los
   * reportes vencieron sin ningún cierre (ciclo incompleto, T-050).
   */
  motivo: MotivoCierre | null;
}

/**
 * Decide si el evento abierto de un (sector, servicio) se cierra (CON-06). Se cierra cuando hay N
 * residentes distintos con `fin_en` dentro de una misma ventana `W` o, si no, cuando ya no queda
 * ningún reporte abierto y hay al menos un cierre: todos los que reportaron dijeron que volvió.
 * Eso evita que un evento quede abierto para siempre cuando solo hubo N reportantes y cerraron en
 * momentos distintos. Un residente cuenta una vez, con su cierre más antiguo (CON-04).
 *
 * Si no queda ningún reporte vivo y nadie cerró, todos vencieron (D-015): el evento termina como
 * **incompleto** y sin hora de fin (T-050, D-024). Inventarle un fin metería en la mediana una
 * duración que nadie observó; dejarlo abierto sumaría el próximo corte a este.
 */
export function evaluarRestablecimiento(
  cerrados: readonly ReporteCerrado[],
  { n, ventanaMin, inicioEvento, reportesAbiertos }: ParametrosRestablecimiento,
): ResultadoRestablecimiento {
  validarN(n);
  const ventanaMs = ventanaMin * MS_MINUTO;
  const delEvento = cerrados.filter((c) => c.finEn.getTime() >= inicioEvento.getTime());
  const unicas = unoPorResidente(
    delEvento.map((c) => ({ residenteId: c.residenteId, hora: c.finEn })),
  );

  const ganadora = primeraVentana(unicas, n, ventanaMs);
  if (ganadora) {
    return { cerrado: true, finEvento: medianaDeHoras(ganadora), motivo: 'consenso' };
  }
  if (reportesAbiertos === 0 && unicas.length > 0) {
    return {
      cerrado: true,
      finEvento: medianaDeHoras(unicas.map((m) => m.hora)),
      motivo: 'sin_abiertos',
    };
  }
  if (reportesAbiertos === 0) {
    return { cerrado: true, finEvento: null, motivo: 'incompleto' };
  }
  return { cerrado: false, finEvento: null, motivo: null };
}
