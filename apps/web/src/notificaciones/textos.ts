import { EstadoServicio, type TipoServicio } from '@blackout/shared';
import type { ResultadoActivar } from '../aplicacion/notificaciones';
import type { EstadoPush } from '../dominio/push';
import type { EstadoSector } from '../dominio/tipos';

// Textos de las notificaciones dentro de la app (T-072), con la voz B de D-042: el vecino
// valenciano que avisa, con tuteo y sin alarmismo. Puros, para probarlos sin React.

const SERVICIO: Record<TipoServicio, { con: string; vuelve: string }> = {
  electricidad: { con: 'la luz', vuelve: 'Volvió' },
  agua: { con: 'el agua', vuelve: 'Llegó' },
};

/**
 * El aviso dentro de la app cuando cambia el estado de tu sector estando abierta (Realtime). Es lo
 * que ve quien no puede recibir push (iPhone sin la app instalada). Solo los cambios confirmados:
 * los reportes sin confirmar no merecen interrumpir.
 */
export function textoCambioSector(
  anterior: EstadoSector | undefined,
  fila: EstadoSector,
  sectorNombre: string,
): string | null {
  const s = SERVICIO[fila.tipoServicio];
  const antes = anterior?.estado ?? EstadoServicio.ConServicio;
  if (antes === fila.estado) return null;
  if (fila.estado === EstadoServicio.SinServicio) {
    return `Se fue ${s.con} en ${sectorNombre}: tus vecinos lo confirmaron.`;
  }
  return fila.tipoServicio === 'agua'
    ? `¡${s.vuelve} ${s.con} a ${sectorNombre}! Aprovecha y llena los tobos.`
    : `¡${s.vuelve} ${s.con} a ${sectorNombre}!`;
}

/** Qué decirle al vecino en Cuenta según lo que su navegador permite. `null`: se puede activar. */
export function textoEstadoPush(estado: EstadoPush, claveActiva: boolean): string | null {
  switch (estado) {
    case 'no-soportado':
      return 'Este navegador no puede recibir notificaciones. Prueba con Chrome, Edge, Firefox o Safari.';
    case 'requiere-instalar':
      return 'En iPhone y iPad las notificaciones solo llegan con la app instalada: toca Compartir, luego «Añadir a pantalla de inicio», y ábrela desde ahí.';
    case 'denegado':
      return 'Bloqueaste las notificaciones de BlackoutTracker. Para activarlas, toca el candado junto a la dirección (o abre los ajustes del navegador) y permite las notificaciones.';
    default:
      return claveActiva ? null : 'Las notificaciones todavía no están disponibles.';
  }
}

/** Lo que se le dice al vecino después de intentar activarlas. */
export function textoResultadoActivar(resultado: ResultadoActivar): string {
  switch (resultado) {
    case 'activadas':
      return '¡Listo! Te avisamos cuando tus vecinos lo confirmen.';
    case 'denegado':
      return 'Sin permiso no te podemos avisar. Si cambias de idea, actívalas en Cuenta.';
    case 'inactivo':
      return 'Las notificaciones todavía no están disponibles.';
    case 'no-soportado':
      return 'Este navegador no puede recibir notificaciones.';
  }
}

/** Las horas silenciosas de D-042, tal como se explican en Cuenta. */
export const TEXTO_SILENCIO =
  'Entre las 22:00 y las 07:00 no te suena nada: lo que pase de noche te llega a las 07:00.';
