import {
  iniciarRecorrido,
  type ContextoRecorrido,
  type EstadoRecorrido,
  type IdPaso,
} from '../../aplicacion/recorrido';
import { navegar, type Ruta } from '../../navegacion/ruta';
import { recorrido } from '../recuerdo';

/** La pantalla que abre cada paso del recorrido (D-043). */
export const PANTALLA_PASO: Readonly<
  Record<IdPaso, { ruta: Ruta; consulta?: Record<string, string> }>
> = {
  cuenta: { ruta: '/entrar', consulta: { modo: 'crear' } },
  entrar: { ruta: '/cuenta' },
  vivienda: { ruta: '/registro' },
  mapa: { ruta: '/' },
  avisar: { ruta: '/reportar' },
  consenso: { ruta: '/reportar' },
  estimacion: { ruta: '/' },
  'sin-conexion': { ruta: '/avisos' },
};

/** Guarda el nuevo estado y, si empieza un paso en otra pantalla (o con otra consulta), la abre. */
export function irEnRecorrido(
  nuevo: EstadoRecorrido | null,
  desde: { paso: EstadoRecorrido['paso'] | null; ruta: Ruta },
): void {
  recorrido.fijar(nuevo);
  if (!nuevo || nuevo.paso === 'fin' || nuevo.paso === desde.paso) return;
  const { ruta, consulta } = PANTALLA_PASO[nuevo.paso];
  if (ruta !== desde.ruta || consulta) navegar(ruta, { consulta });
}

/** "Empezar" (la bienvenida) y "Repetir el recorrido" (Cuenta). */
export function empezarRecorrido(ctx: ContextoRecorrido, rutaActual: Ruta): void {
  irEnRecorrido(iniciarRecorrido(ctx), { paso: null, ruta: rutaActual });
}
