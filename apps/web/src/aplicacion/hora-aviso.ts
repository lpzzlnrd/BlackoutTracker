import {
  REPORTE_MAX_ANTIGUEDAD_DIAS_POR_DEFECTO,
  TOLERANCIA_RELOJ_MIN,
  type FechaIso,
} from '@blackout/shared';
import type { AccionAviso } from '../dominio/tipos';

// La hora real del evento (OFF-03), con las mismas reglas que la API (PLAN.md §5, T-020): no al
// futuro más allá de la tolerancia de reloj, no más antigua que 7 días y un cierre nunca antes
// de su inicio (REP-07). Validar aquí evita encolar un aviso que el servidor rechazaría con 422.

export type MotivoHoraInvalida = 'ilegible' | 'futura' | 'antigua' | 'antes-del-inicio';

export type ResultadoHora = { valida: true } | { valida: false; motivo: MotivoHoraInvalida };

const MINUTO = 60_000;
const DIA = 86_400_000;

export function validarHoraAviso(entrada: {
  accion: AccionAviso;
  ocurridoEn: FechaIso;
  ahora: FechaIso;
  /** Solo en un cierre: el inicio del corte que se cierra. */
  inicioEn?: FechaIso;
}): ResultadoHora {
  const ms = Date.parse(entrada.ocurridoEn);
  const ahora = Date.parse(entrada.ahora);
  if (Number.isNaN(ms)) return { valida: false, motivo: 'ilegible' };
  if (ms > ahora + TOLERANCIA_RELOJ_MIN * MINUTO) return { valida: false, motivo: 'futura' };
  if (entrada.accion === 'inicio') {
    if (ms < ahora - REPORTE_MAX_ANTIGUEDAD_DIAS_POR_DEFECTO * DIA) {
      return { valida: false, motivo: 'antigua' };
    }
  } else if (entrada.inicioEn && ms < Date.parse(entrada.inicioEn)) {
    // El cierre no tiene tope de antigüedad: ya lo acota su inicio (como en la API).
    return { valida: false, motivo: 'antes-del-inicio' };
  }
  return { valida: true };
}

export const MENSAJE_HORA: Readonly<Record<MotivoHoraInvalida, string>> = {
  ilegible: 'Escribe la fecha y la hora completas.',
  futura: 'La hora no puede ser futura.',
  antigua: `Solo se aceptan cortes de los últimos ${REPORTE_MAX_ANTIGUEDAD_DIAS_POR_DEFECTO} días.`,
  'antes-del-inicio': 'El servicio no pudo volver antes de que empezara el corte.',
};

// Venezuela usa UTC−4 todo el año (sin horario de verano desde 2016): el `datetime-local` se
// lee y se escribe siempre en hora de Caracas, sin depender de la zona del teléfono.
const DESFASE_CARACAS = '-04:00';
const DESFASE_CARACAS_MS = -4 * 60 * MINUTO;

/** "2026-10-07T14:20" (hora de Caracas, como la da `<input type="datetime-local">`) → ISO. */
export function isoDesdeLocalCaracas(local: string): FechaIso | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const ms = Date.parse(`${local}:00${DESFASE_CARACAS}`);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

/** ISO → "2026-10-07T14:20" en hora de Caracas, para el valor, `min` y `max` del input. */
export function localCaracasDesdeIso(iso: FechaIso): string {
  return new Date(Date.parse(iso) + DESFASE_CARACAS_MS).toISOString().slice(0, 16);
}
