import { TipoServicio } from '@blackout/shared';
import type { AccionAviso, AvisoCola } from './tipos';

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

export interface ResumenCola {
  /** Avisos que aún no llegaron al servidor: pendientes o rechazados. */
  sinEnviar: number;
  /** Alguno se rechazó: necesita que el vecino lo reintente o lo descarte. */
  conError: boolean;
}

/**
 * Lo que cuenta la insignia de Avisos (D-037). Con algún error se pinta como _Error_ y si no, como
 * _Pendiente_: los mismos colores que los chips de sincronización (CANON §3).
 */
export function resumenCola(avisos: readonly AvisoCola[] | undefined): ResumenCola {
  const lista = avisos ?? [];
  return {
    sinEnviar: lista.filter((a) => a.estado !== 'enviado').length,
    conError: lista.some((a) => a.estado === 'error'),
  };
}

/** "1 aviso sin enviar" / "3 avisos sin enviar". */
export const textoSinEnviar = (n: number): string =>
  `${n} ${n === 1 ? 'aviso' : 'avisos'} sin enviar`;
