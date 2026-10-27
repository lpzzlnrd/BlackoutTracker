import type { FechaIso } from '@blackout/shared';
import { crearEmisor } from '../../../dominio/observable';
import type { EstadoSector } from '../../../dominio/tipos';
import type { EstadosSector } from '../../puertos';
import type { DatosEjemplo } from './escenario';
import { esperar, type EntornoMock } from './entorno';

export interface EstadosSectorMock extends EstadosSector {
  /** Simula un cambio llegado por Realtime: actualiza la fila y avisa a los suscriptores. */
  emitirCambio(fila: EstadoSector): void;
}

export function crearEstadosSectorMock(
  estados: DatosEjemplo['estados'],
  actualizadoEn: FechaIso,
  entorno: EntornoMock,
): EstadosSectorMock {
  const clave = (f: Pick<EstadoSector, 'sectorId' | 'tipoServicio'>) =>
    `${f.sectorId}/${f.tipoServicio}`;
  const filas = new Map<string, EstadoSector>(
    estados.map((e) => [clave(e), { ...e, actualizadoEn }]),
  );
  const cambios = crearEmisor<EstadoSector>();

  return {
    async leerTodos() {
      await esperar(entorno.latenciaMs);
      return [...filas.values()].map((f) => ({ ...f }));
    },
    suscribir: (alCambiar) => cambios.suscribir(alCambiar),
    emitirCambio(fila) {
      filas.set(clave(fila), { ...fila });
      cambios.emitir({ ...fila });
    },
  };
}
