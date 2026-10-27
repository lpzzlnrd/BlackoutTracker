import { EstadoServicio, type EventoSectorDto, type TipoServicio } from '@blackout/shared';
import { hora } from '../utils/formato';
import { estadoVisual, GRAVEDAD } from './estado-visual';
import type { EstadoSector, EstadoVisual } from './tipos';

// Lógica del Panel (S4): la lista de sectores es la alternativa accesible al mapa (CANON §4.6).
// Sin React: se prueba en Node.

export interface FilaPanel {
  sectorId: number;
  nombre: string;
  /** El sector del residente: va primero y lleva la etiqueta "Tu sector". */
  propio: boolean;
  fila: EstadoSector | undefined;
  estado: EstadoVisual;
}

/**
 * Una fila por sector para el servicio elegido (VIS-02: agua y luz nunca se mezclan). Orden: el
 * sector propio primero, después del peor estado al mejor y, a igual estado, por número de sector.
 */
export function filasPanel(
  sectores: readonly { id: number; nombre: string }[],
  estados: readonly EstadoSector[] | undefined,
  servicio: TipoServicio,
  sectorPropio?: number,
): FilaPanel[] {
  return sectores
    .map((sector) => {
      const fila = estados?.find((e) => e.sectorId === sector.id && e.tipoServicio === servicio);
      return {
        sectorId: sector.id,
        nombre: sector.nombre,
        propio: sector.id === sectorPropio,
        fila,
        estado: estadoVisual(fila),
      };
    })
    .sort(
      (a, b) =>
        Number(b.propio) - Number(a.propio) ||
        GRAVEDAD[a.estado] - GRAVEDAD[b.estado] ||
        a.sectorId - b.sectorId,
    );
}

/** Cuántos sectores hay en cada estado, en el orden de la leyenda (solo los que aparecen). */
export function recuentoPorEstado(filas: readonly FilaPanel[]): [EstadoVisual, number][] {
  const orden: EstadoVisual[] = ['sin-servicio', 'sin-confirmar', 'con-servicio', 'sin-datos'];
  return orden
    .map((estado): [EstadoVisual, number] => [
      estado,
      filas.filter((f) => f.estado === estado).length,
    ])
    .filter(([, cantidad]) => cantidad > 0);
}

/**
 * La línea bajo el chip (CANON §7): sin servicio, "Desde las 14:20"; con reportes sin confirmar,
 * "2 de 3 reportes" (CON-01); con servicio o sin datos, nada.
 */
export function lineaEstado(
  fila: Pick<EstadoSector, 'estado' | 'reportesSinConfirmar' | 'desde'> | undefined,
  consensoN: number,
): string | null {
  if (!fila) return null;
  if (fila.estado === EstadoServicio.SinServicio) {
    return fila.desde ? `Desde las ${hora(fila.desde)}` : 'Sin servicio';
  }
  if (fila.reportesSinConfirmar > 0) return `${fila.reportesSinConfirmar} de ${consensoN} reportes`;
  return null;
}

/** "09:10 a 12:40" (A §4): el intervalo de un corte cerrado, en hora de Caracas. */
export const intervalo = (evento: Pick<EventoSectorDto, 'inicioEn' | 'finEn'>): string =>
  evento.finEn
    ? `${hora(evento.inicioEn)} a ${hora(evento.finEn)}`
    : `Desde las ${hora(evento.inicioEn)}`;

/** `?sector=` de la URL: un entero positivo, o `null` si no es un sector posible. */
export function leerSectorId(valor: string | null): number | null {
  if (valor === null || !/^\d+$/.test(valor)) return null;
  const id = Number(valor);
  return id > 0 && Number.isSafeInteger(id) ? id : null;
}
