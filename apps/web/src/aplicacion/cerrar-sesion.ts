import type { Puertos } from '../datos/puertos';

export type DependenciasCerrarSesion = Pick<Puertos, 'sesion' | 'colaAvisos'>;

/**
 * Cierra la sesión y borra la cola: los avisos son de este residente y no deben enviarse con la
 * cuenta del siguiente que entre en el mismo teléfono. Primero la sesión: si falla, no se pierde
 * nada. La caché de consultas la vacía quien llama (la interfaz).
 */
export async function cerrarSesion({
  sesion,
  colaAvisos,
}: DependenciasCerrarSesion): Promise<void> {
  await sesion.cerrar();
  await colaAvisos.vaciar();
}
