import type { Desuscribir } from '../../dominio/observable';
import type { EstadoSector } from '../../dominio/tipos';

/**
 * `estado_sector`: lo único que el front lee directo de Supabase (REST y Realtime). Una
 * instantánea más los cambios en vivo (VIS-03); el cliente persiste la última instantánea.
 */
export interface EstadosSector {
  /** Todas las filas: un sector por servicio. */
  leerTodos(): Promise<EstadoSector[]>;
  /** Avisa de cada fila que cambia. Devuelve la baja. */
  suscribir(alCambiar: (fila: EstadoSector) => void): Desuscribir;
}
