import type { EstimacionDto, TipoServicio } from '@blackout/shared';
import type { RepositorioEstimaciones } from '../../puertos';
import type { DatosEjemplo } from './escenario';
import { esperar, type EntornoMock } from './entorno';

/** Busca la estimación de (sector, servicio); sin ciclos cerrados, `n = 0` y sin cifra (EST-04). */
export function buscarEstimacion(
  estimaciones: DatosEjemplo['estimaciones'],
  sectorId: number,
  tipoServicio: TipoServicio,
): EstimacionDto {
  const fila = estimaciones.find((e) => e.sectorId === sectorId && e.tipoServicio === tipoServicio);
  if (!fila) return { suficiente: false, n: 0 };
  // La respuesta real no repite sectorId ni tipoServicio: van en la consulta.
  const { sectorId: _s, tipoServicio: _t, ...estimacion } = fila;
  return estimacion;
}

export function crearRepositorioEstimacionesMock(
  estimaciones: DatosEjemplo['estimaciones'],
  entorno: EntornoMock,
): RepositorioEstimaciones {
  return {
    async obtener(sectorId, tipoServicio) {
      await esperar(entorno.latenciaMs);
      return buscarEstimacion(estimaciones, sectorId, tipoServicio);
    },
  };
}
