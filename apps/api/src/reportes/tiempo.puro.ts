// Validación de las horas de un reporte. Lógica pura: no importa Nest ni Drizzle y NUNCA llama a
// `Date.now()`; recibe `ahora` como parámetro, así los tests fijan el reloj (docs/PLAN.md §3 y §5).
import { REPORTE_MAX_ANTIGUEDAD_DIAS_POR_DEFECTO, TOLERANCIA_RELOJ_MIN } from '@blackout/shared';

const MS_MINUTO = 60_000;
const MS_DIA = 24 * 60 * MS_MINUTO;

export type MotivoHoraInvalida = 'FECHA_ILEGIBLE' | 'FUTURO' | 'ANTIGUA' | 'FIN_ANTES_DE_INICIO';

export type ResultadoHora = { valida: true } | { valida: false; motivo: MotivoHoraInvalida };

export interface LimitesTiempo {
  /** Desfase de reloj que se tolera hacia el futuro (D-013). */
  toleranciaMin: number;
  /** Cuánto puede tardar en llegar un reporte de una cola offline (D-013). */
  maxAntiguedadDias: number;
}

export const LIMITES_POR_DEFECTO: LimitesTiempo = {
  toleranciaMin: TOLERANCIA_RELOJ_MIN,
  maxAntiguedadDias: REPORTE_MAX_ANTIGUEDAD_DIAS_POR_DEFECTO,
};

const invalida = (motivo: MotivoHoraInvalida): ResultadoHora => ({ valida: false, motivo });
const VALIDA: ResultadoHora = { valida: true };

/** Convierte un ISO 8601 en `Date`; `null` si no es una fecha real. */
export function leerFecha(iso: string): Date | null {
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

/**
 * Hora del inicio de un reporte (OFF-03: es la hora real del evento, no la del envío). No puede
 * estar en el futuro (con la tolerancia) ni ser más antigua que el máximo. Los límites son
 * inclusivos: exactamente `ahora + tolerancia` y exactamente `ahora − máximo` se aceptan.
 */
export function validarInicio(
  inicio: Date,
  ahora: Date,
  limites: LimitesTiempo = LIMITES_POR_DEFECTO,
): ResultadoHora {
  if (inicio.getTime() > ahora.getTime() + limites.toleranciaMin * MS_MINUTO) {
    return invalida('FUTURO');
  }
  if (inicio.getTime() < ahora.getTime() - limites.maxAntiguedadDias * MS_DIA) {
    return invalida('ANTIGUA');
  }
  return VALIDA;
}

/**
 * Hora del cierre. No puede estar en el futuro (con la tolerancia) y debe ser `≥` el inicio
 * (REP-07): nunca se guarda una duración negativa ni se corrige en silencio. Un fin igual al
 * inicio es una duración cero y se acepta.
 */
export function validarCierre(
  fin: Date,
  inicio: Date,
  ahora: Date,
  limites: LimitesTiempo = LIMITES_POR_DEFECTO,
): ResultadoHora {
  if (fin.getTime() > ahora.getTime() + limites.toleranciaMin * MS_MINUTO) {
    return invalida('FUTURO');
  }
  if (fin.getTime() < inicio.getTime()) return invalida('FIN_ANTES_DE_INICIO');
  return VALIDA;
}

/** Minutos entre el inicio y el fin (pueden ser fraccionarios). */
export function duracionMin(inicio: Date, fin: Date): number {
  return (fin.getTime() - inicio.getTime()) / MS_MINUTO;
}

/** Texto en español para el cuerpo del 422 `HORA_INVALIDA`. */
export function mensajeHoraInvalida(motivo: MotivoHoraInvalida, limites = LIMITES_POR_DEFECTO) {
  switch (motivo) {
    case 'FECHA_ILEGIBLE':
      return 'La hora no es una fecha válida';
    case 'FUTURO':
      return 'La hora no puede estar en el futuro';
    case 'ANTIGUA':
      return `La hora no puede ser anterior a ${limites.maxAntiguedadDias} días`;
    case 'FIN_ANTES_DE_INICIO':
      return 'La hora de restablecimiento no puede ser anterior a la del inicio del corte';
  }
}
