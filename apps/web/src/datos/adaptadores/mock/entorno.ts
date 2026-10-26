import { ErrorApiCliente } from '../../../dominio/errores';
import type { Conexion, Reloj } from '../../puertos';

/** Lo que comparten los mocks para comportarse como un solo mundo coherente. */
export interface EntornoMock {
  reloj: Reloj;
  conexion: Conexion;
  /** Retardo simulado de cada llamada, para probar esqueletos de carga o 3G. 0 = inmediato. */
  latenciaMs: number;
}

export const esperar = (ms: number): Promise<void> =>
  ms > 0 ? new Promise((resolver) => setTimeout(resolver, ms)) : Promise.resolve();

/**
 * Las escrituras fallan sin red, como el `fetch` real. Las lecturas no: en producción las sirve
 * el service worker desde su caché (PWA.md §4) y el puerto no se entera.
 */
export function exigirRed(entorno: EntornoMock): void {
  if (entorno.conexion.leer().modo === 'sin-conexion') throw new ErrorApiCliente(0);
}

export const horaMs = (iso: string): number => Date.parse(iso);

export const minutosEntre = (inicioIso: string, finIso: string): number =>
  Math.round((horaMs(finIso) - horaMs(inicioIso)) / 60_000);
