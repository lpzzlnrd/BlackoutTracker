import {
  CodigoError,
  REPORTE_MAX_ANTIGUEDAD_DIAS_POR_DEFECTO,
  TOLERANCIA_RELOJ_MIN,
  type ReporteDto,
} from '@blackout/shared';
import { ErrorApiCliente } from '../../../dominio/errores';
import type { RepositorioReportes, Sesion } from '../../puertos';
import { esperar, exigirRed, horaMs, minutosEntre, type EntornoMock } from './entorno';

/**
 * Reproduce en memoria las reglas de `PUT /reportes/:id` y `PATCH /reportes/:id/cierre`
 * (PLAN.md §5): idempotencia por id (OFF-05), un solo reporte abierto por servicio (REP-05),
 * duración nunca negativa (REP-07), cierre sin inicio bloqueado (D-003) y horas dentro de los
 * límites (D-013). Así la cola y los formularios se prueban sin el backend.
 *
 * No calcula el consenso: con un solo residente, un aviso nunca cambia `estado_sector`.
 */
export function crearRepositorioReportesMock(opciones: {
  entorno: EntornoMock;
  sesion: Sesion;
  /** Sector del residente; `null` si no ha terminado el registro (403). */
  sectorActual: () => number | null;
  /** Reportes que ya existen al empezar (p. ej. el corte abierto de la demo). */
  semilla?: ReporteDto[];
}): RepositorioReportes {
  const { entorno, sesion, sectorActual } = opciones;
  const reportes = new Map<string, ReporteDto>((opciones.semilla ?? []).map((r) => [r.id, r]));

  /** Lo que comprueba el servidor en cada llamada, antes de mirar el cuerpo. */
  async function entrar(): Promise<number> {
    exigirRed(entorno);
    await esperar(entorno.latenciaMs);
    if (!(await sesion.token())) throw new ErrorApiCliente(401, CodigoError.NoAutenticado);
    const sector = sectorActual();
    if (sector === null) throw new ErrorApiCliente(403, CodigoError.RegistroIncompleto);
    return sector;
  }

  function validarHora(ocurridoEn: string): void {
    const ms = horaMs(ocurridoEn);
    const ahora = horaMs(entorno.reloj.ahora());
    const futuro = ms > ahora + TOLERANCIA_RELOJ_MIN * 60_000;
    const antiguo = ms < ahora - REPORTE_MAX_ANTIGUEDAD_DIAS_POR_DEFECTO * 86_400_000;
    if (Number.isNaN(ms) || futuro || antiguo) {
      throw new ErrorApiCliente(422, CodigoError.HoraInvalida);
    }
  }

  return {
    async iniciar(id, { tipoServicio, ocurridoEn }) {
      const sectorId = await entrar();
      validarHora(ocurridoEn);

      const existente = reportes.get(id);
      if (existente) {
        const igual =
          existente.tipoServicio === tipoServicio &&
          horaMs(existente.inicioEn) === horaMs(ocurridoEn);
        if (!igual) throw new ErrorApiCliente(409, CodigoError.ReporteConflicto);
        return { ...existente };
      }

      const abierto = [...reportes.values()].some(
        (r) => r.tipoServicio === tipoServicio && r.finEn === null,
      );
      if (abierto) throw new ErrorApiCliente(409, CodigoError.ReporteAbiertoDuplicado);

      const nuevo: ReporteDto = {
        id,
        tipoServicio,
        sectorId,
        inicioEn: ocurridoEn,
        finEn: null,
        duracionMin: null,
        recibidoEn: entorno.reloj.ahora(),
      };
      reportes.set(id, nuevo);
      return { ...nuevo };
    },

    async cerrar(id, { ocurridoEn }) {
      await entrar();
      const reporte = reportes.get(id);
      if (!reporte) throw new ErrorApiCliente(404, CodigoError.ReporteNoEncontrado);
      validarHora(ocurridoEn);

      if (reporte.finEn !== null) {
        if (horaMs(reporte.finEn) !== horaMs(ocurridoEn)) {
          throw new ErrorApiCliente(409, CodigoError.ReporteConflicto);
        }
        return { ...reporte };
      }
      if (horaMs(ocurridoEn) < horaMs(reporte.inicioEn)) {
        throw new ErrorApiCliente(422, CodigoError.HoraInvalida);
      }

      const cerrado: ReporteDto = {
        ...reporte,
        finEn: ocurridoEn,
        duracionMin: minutosEntre(reporte.inicioEn, ocurridoEn),
        recibidoEn: entorno.reloj.ahora(),
      };
      reportes.set(id, cerrado);
      return { ...cerrado };
    },

    async obtenerMios({ abiertos = false } = {}) {
      await entrar();
      return [...reportes.values()]
        .filter((r) => !abiertos || r.finEn === null)
        .map((r) => ({ ...r }));
    },
  };
}
