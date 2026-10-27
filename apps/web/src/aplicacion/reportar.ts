import type { FechaIso, TipoServicio } from '@blackout/shared';
import type { Puertos } from '../datos/puertos';
import type { AvisoCola } from '../dominio/tipos';
import { nuevoId } from '../utils/id';
import type { CorteAbierto } from './corte-abierto';

export interface DependenciasReportar extends Pick<Puertos, 'colaAvisos'> {
  /** Dispara un envío de la cola (el sincronizador compartido). Sin red falla y no pasa nada. */
  sincronizar?: () => Promise<unknown>;
  /** Solo para los tests; por defecto, `crypto.randomUUID`. */
  generarId?: () => string;
}

/**
 * Toda acción del vecino entra primero en la cola y se ve al instante como _pendiente_ (OFF-01);
 * después se intenta enviar sin esperar al resultado. Si no hay red, el aviso queda guardado y
 * sale solo cuando vuelve (OFF-02). Los ids se generan una sola vez, aquí: son la clave de
 * idempotencia que se repite en cada reintento (OFF-05).
 */
async function encolar(
  deps: DependenciasReportar,
  aviso: Omit<AvisoCola, 'estado' | 'codigoError'>,
): Promise<AvisoCola> {
  const guardado = await deps.colaAvisos.agregar(aviso);
  void deps.sincronizar?.().catch(() => undefined);
  return guardado;
}

/** "Se fue la luz / el agua": `PUT /reportes/:id` con un `reporteId` nuevo (REP-01, REP-02). */
export function avisarInicio(
  deps: DependenciasReportar,
  { tipoServicio, ocurridoEn }: { tipoServicio: TipoServicio; ocurridoEn: FechaIso },
): Promise<AvisoCola> {
  const generar = deps.generarId ?? nuevoId;
  const reporteId = generar();
  // `id` y `reporteId` coinciden en un inicio; el cierre tiene id propio (D-023).
  return encolar(deps, { id: reporteId, reporteId, tipoServicio, accion: 'inicio', ocurridoEn });
}

/** "Ya volvió…": `PATCH /reportes/:id/cierre` del corte abierto (REP-03). */
export function avisarCierre(
  deps: DependenciasReportar,
  {
    abierto,
    tipoServicio,
    ocurridoEn,
  }: { abierto: CorteAbierto; tipoServicio: TipoServicio; ocurridoEn: FechaIso },
): Promise<AvisoCola> {
  const generar = deps.generarId ?? nuevoId;
  return encolar(deps, {
    id: generar(),
    reporteId: abierto.reporteId,
    tipoServicio,
    accion: 'cierre',
    ocurridoEn,
  });
}
