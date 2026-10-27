import { EstadoServicio, type TipoServicio } from '@blackout/shared';
import { nombreServicio } from '../utils/formato';
import type { EstadoSector, EstadoVisual } from './tipos';

/** Texto corto de los chips (CANON §3). */
export const ETIQUETA_ESTADO: Readonly<Record<EstadoVisual, string>> = {
  'con-servicio': 'Con servicio',
  'sin-confirmar': 'Sin confirmar',
  'sin-servicio': 'Sin servicio',
  'sin-datos': 'Sin datos',
};

/** Titular del estado en el detalle y en el panel (D-038): "Sin luz", "Con agua"… */
export function titularEstado(estado: EstadoVisual, servicio: TipoServicio): string {
  const nombre = nombreServicio(servicio).toLowerCase();
  switch (estado) {
    case 'sin-servicio':
      return `Sin ${nombre}`;
    case 'con-servicio':
      return `Con ${nombre}`;
    case 'sin-confirmar':
      return 'Reportes sin confirmar';
    case 'sin-datos':
      return 'Sin datos';
  }
}

/** Orden de gravedad, de peor a mejor: así se ordenan los "otros sectores" de B. */
export const GRAVEDAD: Readonly<Record<EstadoVisual, number>> = {
  'sin-servicio': 0,
  'sin-confirmar': 1,
  'sin-datos': 2,
  'con-servicio': 3,
};

/** CANON §3: "sin servicio" gana aunque haya reportes sin confirmar; sin fila no hay datos. */
export function estadoVisual(fila: EstadoSector | undefined): EstadoVisual {
  if (!fila) return 'sin-datos';
  if (fila.estado === EstadoServicio.SinServicio) return 'sin-servicio';
  return fila.reportesSinConfirmar > 0 ? 'sin-confirmar' : 'con-servicio';
}

/** El peor estado entre varias filas (un sector con dos servicios). */
export function peorEstado(filas: readonly EstadoSector[]): EstadoVisual {
  if (filas.length === 0) return 'sin-datos';
  return filas.map((f) => estadoVisual(f)).reduce((a, b) => (GRAVEDAD[a] <= GRAVEDAD[b] ? a : b));
}
