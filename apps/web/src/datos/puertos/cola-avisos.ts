import type { CodigoError } from '@blackout/shared';
import type { Desuscribir } from '../../dominio/observable';
import type { AvisoCola, NuevoAviso } from '../../dominio/tipos';

/**
 * Cola persistente de avisos (OFF-06): sobrevive al cierre del navegador. Cada acción del vecino
 * se escribe aquí primero y se ve de inmediato como _pendiente_; el envío lo hace
 * `sincronizarCola`. Nunca vive solo en memoria en producción.
 */
export interface ColaAvisos {
  /** Todos los avisos, por orden cronológico de `ocurridoEn` (OFF-04). */
  listar(): Promise<AvisoCola[]>;
  /** Guarda un aviso nuevo como `pendiente`. Mismo `id` dos veces: no duplica. */
  agregar(aviso: NuevoAviso): Promise<AvisoCola>;
  marcarEnviado(id: string): Promise<void>;
  marcarError(id: string, codigo?: CodigoError): Promise<void>;
  /** Vuelve un aviso con error a `pendiente` ("Reintentar"). */
  reintentar(id: string): Promise<void>;
  /** "Descartar". */
  quitar(id: string): Promise<void>;
  /** Cerrar sesión borra la cola. */
  vaciar(): Promise<void>;
  /** Avisa de cualquier cambio, venga de donde venga. */
  suscribir(alCambiar: () => void): Desuscribir;
}
