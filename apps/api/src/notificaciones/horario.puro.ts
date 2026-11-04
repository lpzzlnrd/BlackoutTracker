// Horas de Caracas para las notificaciones (T-072, D-042): horas silenciosas, franjas de los
// recordatorios y "hoy". Lógica pura: recibe `ahora`, nunca llama a `Date.now()`.
//
// Venezuela está en UTC−4 todo el año (sin horario de verano desde 2016), así que basta un desfase
// fijo. Es la misma zona que `ZONA_HORARIA` de `@blackout/shared`.

const MS_HORA = 3_600_000;
const DESFASE_CARACAS_MS = -4 * MS_HORA;

/** Horas silenciosas en hora de Caracas: `desde` incluida, `hasta` excluida (22 y 7 → 22:00–06:59). */
export interface Silencio {
  desde: number;
  hasta: number;
}

/** La hora (0 a 23) de Caracas en el instante `t`. */
export function horaCaracas(t: Date): number {
  return new Date(t.getTime() + DESFASE_CARACAS_MS).getUTCHours();
}

/** Medianoche de Caracas del día de `t`: "hoy" para los recordatorios y el resumen. */
export function inicioDelDia(t: Date): Date {
  const local = new Date(t.getTime() + DESFASE_CARACAS_MS);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - DESFASE_CARACAS_MS);
}

/** Si la hora `h` (0 a 23) cae en las horas silenciosas. Con `desde === hasta` no hay silencio. */
export function horaEnSilencio(h: number, s: Silencio): boolean {
  if (s.desde === s.hasta) return false;
  return s.desde < s.hasta ? h >= s.desde && h < s.hasta : h >= s.desde || h < s.hasta;
}

export function enSilencio(t: Date, s: Silencio): boolean {
  return horaEnSilencio(horaCaracas(t), s);
}

/**
 * Cuándo puede sonar algo que pasa en `t`: `t` mismo, o el fin de las horas silenciosas (las 07:00
 * siguientes) si cae dentro de ellas.
 */
export function primerMomentoPermitido(t: Date, s: Silencio): Date {
  if (!enSilencio(t, s)) return t;
  const fin = new Date(inicioDelDia(t).getTime() + s.hasta * MS_HORA);
  return fin.getTime() > t.getTime() ? fin : new Date(fin.getTime() + 24 * MS_HORA);
}

/**
 * Si `t` cae en la franja de una de las `horas` de recordatorio ([h:00, h:59]), cuántas franjas van
 * ya en el día contando esa: es el tope de recordatorios hasta ese momento. Fuera de toda franja
 * devuelve `null`. Las horas que caen en el silencio se ignoran.
 */
export function franjasIniciadas(t: Date, horas: readonly number[], s: Silencio): number | null {
  const validas = [...new Set(horas)].filter((h) => !horaEnSilencio(h, s));
  const h = horaCaracas(t);
  if (!validas.includes(h)) return null;
  return validas.filter((x) => x <= h).length;
}

/** El tope diario de recordatorios: una por cada hora de franja válida. */
export function topeDiario(horas: readonly number[], s: Silencio): number {
  return [...new Set(horas)].filter((h) => !horaEnSilencio(h, s)).length;
}
