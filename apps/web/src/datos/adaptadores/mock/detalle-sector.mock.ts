import {
  CodigoError,
  EstadoServicio,
  OrigenEvento,
  TIPOS_SERVICIO,
  type EventoSectorDto,
  type TipoServicio,
} from '@blackout/shared';
import { ErrorApiCliente } from '../../../dominio/errores';
import type { RepositorioDetalleSector } from '../../puertos';
import type { DatosEjemplo } from './escenario';
import { esperar, minutosEntre, type EntornoMock } from './entorno';
import { buscarEstimacion } from './estimaciones.mock';

const TAMANO_PAGINA = 20;

/** Resumen e historial armados a partir de los eventos, estados y estimaciones de ejemplo. */
export function crearRepositorioDetalleSectorMock(
  datos: Pick<DatosEjemplo, 'sectores' | 'estados' | 'estimaciones' | 'eventos'>,
  entorno: EntornoMock,
  tamanoPagina = TAMANO_PAGINA,
): RepositorioDetalleSector {
  const sectorOError = (sectorId: number) => {
    const sector = datos.sectores.find((s) => s.id === sectorId);
    if (!sector) throw new ErrorApiCliente(404, CodigoError.SectorNoEncontrado);
    return sector;
  };

  const eventosDe = (sectorId: number, tipoServicio?: TipoServicio): EventoSectorDto[] =>
    datos.eventos
      .filter((e) => e.sectorId === sectorId && (!tipoServicio || e.tipoServicio === tipoServicio))
      .sort((a, b) => Date.parse(b.inicioEn) - Date.parse(a.inicioEn))
      .map((e) => ({
        ...e,
        duracionMin: e.finEn ? minutosEntre(e.inicioEn, e.finEn) : null,
        confirmadoEn: e.inicioEn,
        origen: OrigenEvento.Consenso,
      }));

  return {
    async resumen(sectorId) {
      await esperar(entorno.latenciaMs);
      const sector = sectorOError(sectorId);
      return {
        sectorId,
        sectorNombre: sector.nombre,
        servicios: TIPOS_SERVICIO.map((tipoServicio) => {
          const estado = datos.estados.find(
            (e) => e.sectorId === sectorId && e.tipoServicio === tipoServicio,
          );
          return {
            tipoServicio,
            estado: estado?.estado ?? EstadoServicio.ConServicio,
            reportesSinConfirmar: estado?.reportesSinConfirmar ?? 0,
            desde: estado?.desde ?? null,
            estimacion: buscarEstimacion(datos.estimaciones, sectorId, tipoServicio),
            ultimosEventos: eventosDe(sectorId, tipoServicio).slice(0, 5),
          };
        }),
      };
    },

    async historial(sectorId, { tipoServicio, cursor } = {}) {
      await esperar(entorno.latenciaMs);
      sectorOError(sectorId);
      const cerrados = eventosDe(sectorId, tipoServicio).filter((e) => e.finEn !== null);
      const desde = cursor ? Number(cursor) : 0;
      const hasta = desde + tamanoPagina;
      return {
        eventos: cerrados.slice(desde, hasta),
        siguienteCursor: hasta < cerrados.length ? String(hasta) : null,
      };
    },
  };
}
