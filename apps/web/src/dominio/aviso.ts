import { TipoServicio } from '@blackout/shared';
import type { AccionAviso } from './tipos';

// Textos de los avisos del vecino (CANON §7.1 y §7.2): "luz" y "agua" con su artículo.

const CON_ARTICULO: Readonly<Record<TipoServicio, string>> = {
  [TipoServicio.Electricidad]: 'la luz',
  [TipoServicio.Agua]: 'el agua',
};

/** Fila de la cola: "Se fue la luz" / "Volvió el agua". */
export const textoAccion = (accion: AccionAviso, servicio: TipoServicio): string =>
  `${accion === 'inicio' ? 'Se fue' : 'Volvió'} ${CON_ARTICULO[servicio]}`;

/**
 * Botón principal de Reportar: sin corte abierto, "Se fue la luz"; con uno abierto, "Ya volvió
 * la luz". Depende del corte del propio vecino y no del estado del sector: solo se puede cerrar
 * un reporte propio (D-003).
 */
export const textoBotonReportar = (hayCorteAbierto: boolean, servicio: TipoServicio): string =>
  `${hayCorteAbierto ? 'Ya volvió' : 'Se fue'} ${CON_ARTICULO[servicio]}`;
