import type { FechaIso, ReporteDto, TipoServicio } from '@blackout/shared';
import type { AvisoCola } from '../dominio/tipos';

/** El corte que el vecino tiene abierto en un servicio: lo que cierra "Ya volvió…". */
export interface CorteAbierto {
  /** El `reporteId` que va en `PATCH /reportes/:id/cierre`. */
  reporteId: string;
  inicioEn: FechaIso;
}

/**
 * ¿Tengo un corte abierto de este servicio? Mezcla lo que dice el servidor (`GET /reportes/mios`)
 * con la cola, que va por delante de él (OFF-01, OFF-04):
 * - un inicio en cola (pendiente o ya enviado) cuenta como abierto aunque el servidor aún no lo
 *   liste; uno rechazado (`error`) no existe;
 * - un cierre en cola (pendiente o enviado) cierra su `reporteId`, aunque el servidor siga
 *   viéndolo abierto; un cierre rechazado no cierra nada.
 * Solo hay uno abierto por servicio (REP-05) y agua y luz no se mezclan (REP-06); si por un
 * desfase hubiera dos, gana el más reciente. Sin datos del servidor (sin red), se decide con la cola.
 */
export function corteAbierto(
  servicio: TipoServicio,
  servidor: readonly ReporteDto[] | undefined,
  cola: readonly AvisoCola[] | undefined,
): CorteAbierto | null {
  const vivos = (cola ?? []).filter((a) => a.tipoServicio === servicio && a.estado !== 'error');
  const cerrados = new Set(vivos.filter((a) => a.accion === 'cierre').map((a) => a.reporteId));

  const candidatos = new Map<string, FechaIso>();
  for (const reporte of servidor ?? []) {
    if (reporte.tipoServicio === servicio && reporte.finEn === null) {
      candidatos.set(reporte.id, reporte.inicioEn);
    }
  }
  for (const aviso of vivos) {
    if (aviso.accion === 'inicio' && !candidatos.has(aviso.reporteId)) {
      candidatos.set(aviso.reporteId, aviso.ocurridoEn);
    }
  }

  let elegido: CorteAbierto | null = null;
  for (const [reporteId, inicioEn] of candidatos) {
    if (cerrados.has(reporteId)) continue;
    if (!elegido || Date.parse(inicioEn) > Date.parse(elegido.inicioEn)) {
      elegido = { reporteId, inicioEn };
    }
  }
  return elegido;
}
