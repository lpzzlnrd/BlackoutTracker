import type { TipoServicio } from '@blackout/shared';

// Los tres formateadores de CANON §7.1: reproducen, con los datos de ejemplo, todas las cadenas
// de las referencias. Zona fija `America/Caracas`, hora de 24 h.

const ZONA = 'America/Caracas';
const formatoHora = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZONA,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const formatoDia = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** "14:20": 24 h, hora de Caracas. Se usa 'en-GB' solo porque garantiza HH:mm sin a. m./p. m. */
export const hora = (iso: string): string => formatoHora.format(new Date(iso));

/** "Hoy", "Ayer", "Hace 3 días": por día calendario de Caracas, no por bloques de 24 h. */
export function diaRelativo(iso: string, ahora: string): string {
  const dias = Math.round(
    (Date.parse(`${formatoDia.format(new Date(ahora))}T00:00:00Z`) -
      Date.parse(`${formatoDia.format(new Date(iso))}T00:00:00Z`)) /
      86_400_000,
  );
  return dias === 0 ? 'Hoy' : dias === 1 ? 'Ayer' : `Hace ${dias} días`;
}

/** 240 → "4 h"; 220 → "3 h 40 min"; 305 → "5 h 5 min"; 45 → "45 min". Minutos enteros. */
export function duracion(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** `electricidad` → "Luz"; `agua` → "Agua". */
export const nombreServicio = (tipo: TipoServicio): string =>
  tipo === 'electricidad' ? 'Luz' : 'Agua';

/** "aprox. 4 h", siempre con ese prefijo (CANON §7.1). */
export const estimacionAprox = (medianaMin: number): string => `aprox. ${duracion(medianaMin)}`;

/** "según 12 cortes registrados" / "según 1 corte registrado". */
export const segunCortes = (n: number): string =>
  `según ${n} ${n === 1 ? 'corte registrado' : 'cortes registrados'}`;
