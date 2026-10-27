// Vencimiento de los reportes abiertos (D-015, T-050). Funciones puras: el reloj entra por parámetro.
// El cron y el recálculo al leer solo aplican lo que decide este módulo.

const MS_HORA = 3_600_000;

/**
 * Instante anterior al cual un reporte abierto ya venció: `ahora − horas`. Un reporte vence cuando
 * su inicio es **estrictamente anterior** a este límite (abierto hace *más de* `horas`), así que
 * justo en el borde todavía cuenta. La consulta del cron usa este mismo límite (`inicio_en < límite`).
 */
export function limiteDeVencimiento(ahora: Date, horas: number): Date {
  if (!Number.isFinite(horas) || horas <= 0) {
    throw new RangeError('REPORTE_VENCE_HORAS debe ser un número positivo');
  }
  return new Date(ahora.getTime() - horas * MS_HORA);
}

/** ¿Venció este reporte? Solo los abiertos (sin fin) vencen; uno cerrado es un ciclo completo. */
export function haVencido(
  reporte: { inicioEn: Date; finEn: Date | null },
  ahora: Date,
  horas: number,
): boolean {
  if (reporte.finEn !== null) return false;
  return reporte.inicioEn.getTime() < limiteDeVencimiento(ahora, horas).getTime();
}
