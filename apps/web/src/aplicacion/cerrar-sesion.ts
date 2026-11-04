import type { Puertos } from '../datos/puertos';
import { desactivarNotificaciones } from './notificaciones';

export type DependenciasCerrarSesion = Pick<Puertos, 'sesion' | 'colaAvisos'> &
  Partial<Pick<Puertos, 'notificaciones' | 'push'>>;

/**
 * Cierra la sesión y borra la cola: los avisos son de este residente y no deben enviarse con la
 * cuenta del siguiente que entre en el mismo teléfono. Por lo mismo, antes da de baja las
 * notificaciones de este dispositivo (T-072): la baja en la API necesita la sesión. Si la baja
 * falla no frena la salida. Después, la sesión: si falla, no se pierde nada. La caché de consultas
 * la vacía quien llama (la interfaz).
 */
export async function cerrarSesion({
  sesion,
  colaAvisos,
  notificaciones,
  push,
}: DependenciasCerrarSesion): Promise<void> {
  if (notificaciones && push) {
    await desactivarNotificaciones({ notificaciones, push }).catch(() => undefined);
  }
  await sesion.cerrar();
  await colaAvisos.vaciar();
}
