import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import {
  type CerrarReporteSolicitud,
  CodigoError,
  type IniciarReporteSolicitud,
  type ReporteDto,
} from '@blackout/shared';
import { ErrorNegocio } from '../comun/error-negocio';
import { ConsensoService } from '../consenso/consenso.service';
import { type BaseDeDatos, DB, type Transaccion } from '../db/db.module';
import { reportes } from '../db/schema';
import type { PerfilResidente } from '../residentes/residentes.service';
import {
  duracionMin,
  leerFecha,
  mensajeHoraInvalida,
  type ResultadoHora,
  validarCierre,
  validarInicio,
} from './tiempo.puro';

/** Tope de `GET /reportes/mios` sin filtro (un residente rara vez tiene tantos). */
const LIMITE_MIOS = 100;

export type FilaReporte = typeof reportes.$inferSelect;

/** Reloj inyectable: los tests lo reemplazan para fijar "ahora". */
export const RELOJ = Symbol('RELOJ');
export type Reloj = () => Date;

export function aReporteDto(fila: FilaReporte): ReporteDto {
  return {
    id: fila.id,
    tipoServicio: fila.tipoServicio,
    sectorId: fila.sectorId,
    inicioEn: fila.inicioEn.toISOString(),
    finEn: fila.finEn?.toISOString() ?? null,
    duracionMin: fila.finEn ? duracionMin(fila.inicioEn, fila.finEn) : null,
    recibidoEn: fila.recibidoEn.toISOString(),
  };
}

/** 422 `HORA_INVALIDA` si el resultado de la validación pura no es válido. */
export function exigirHora(resultado: ResultadoHora): void {
  if (!resultado.valida) {
    throw new ErrorNegocio(CodigoError.HoraInvalida, mensajeHoraInvalida(resultado.motivo));
  }
}

export function fechaOError(iso: string): Date {
  const fecha = leerFecha(iso);
  exigirHora(fecha ? { valida: true } : { valida: false, motivo: 'FECHA_ILEGIBLE' });
  return fecha as Date;
}

@Injectable()
export class ReportesService {
  constructor(
    @Inject(DB) private readonly db: BaseDeDatos,
    @Inject(RELOJ) private readonly reloj: Reloj,
    private readonly consenso: ConsensoService,
  ) {}

  /**
   * Inicio idempotente (OFF-05). El `id` lo genera el cliente. Reintentar el mismo PUT devuelve el
   * mismo reporte; el mismo id con otro contenido es un conflicto. Se guarda la hora que envía el
   * cliente (`ocurridoEn`), nunca `now()` (OFF-03); `recibido_en` registra cuándo llegó.
   */
  async iniciar(
    perfil: PerfilResidente,
    id: string,
    solicitud: IniciarReporteSolicitud,
  ): Promise<ReporteDto> {
    const inicio = fechaOError(solicitud.ocurridoEn);
    exigirHora(validarInicio(inicio, this.reloj()));

    return this.db.transaction(async (tx) => {
      const creados = await tx
        .insert(reportes)
        .values({
          id,
          residenteId: perfil.id,
          sectorId: perfil.sectorId,
          tipoServicio: solicitud.tipoServicio,
          inicioEn: inicio,
        })
        // Sin objetivo: absorbe el choque de la clave primaria (reintento) y también el del único
        // parcial de REP-05; abajo se distingue cuál fue.
        .onConflictDoNothing()
        .returning();
      if (creados.length > 0) {
        await this.consenso.reevaluar(tx, perfil.sectorId, solicitud.tipoServicio);
        return aReporteDto(creados[0]);
      }

      const existente = await this.buscar(tx, id);
      if (!existente) {
        // No chocó el id: chocó el único parcial. Ya hay un reporte abierto de ese servicio (REP-05).
        throw new ErrorNegocio(
          CodigoError.ReporteAbiertoDuplicado,
          'Ya tienes un reporte abierto de este servicio',
        );
      }
      const mismoContenido =
        existente.residenteId === perfil.id &&
        existente.tipoServicio === solicitud.tipoServicio &&
        existente.inicioEn.getTime() === inicio.getTime();
      if (!mismoContenido) {
        throw new ErrorNegocio(
          CodigoError.ReporteConflicto,
          'Ese id de reporte ya existe con otro contenido',
        );
      }
      return aReporteDto(existente);
    });
  }

  /**
   * Cierre (regreso del servicio), idempotente. Un id inexistente o ajeno es 404: un cierre sin
   * inicio se bloquea (REP-04, D-003) y el cliente lo reintenta porque el inicio aún puede venir
   * en camino. Cerrar de nuevo con la misma hora devuelve el reporte; con otra, 409. La duración
   * se calcula aquí y nunca es negativa (REP-07).
   */
  async cerrar(
    perfil: PerfilResidente,
    id: string,
    solicitud: CerrarReporteSolicitud,
  ): Promise<ReporteDto> {
    const fin = fechaOError(solicitud.ocurridoEn);

    return this.db.transaction(async (tx) => {
      // FOR UPDATE: dos cierres simultáneos del mismo reporte se ponen en fila y el segundo ve el
      // resultado del primero.
      const [fila] = await tx
        .select()
        .from(reportes)
        .where(and(eq(reportes.id, id), eq(reportes.residenteId, perfil.id)))
        .for('update')
        .limit(1);
      if (!fila) {
        throw new ErrorNegocio(
          CodigoError.ReporteNoEncontrado,
          'No hay un reporte abierto con ese id',
        );
      }

      if (fila.finEn) {
        if (fila.finEn.getTime() === fin.getTime()) return aReporteDto(fila);
        throw new ErrorNegocio(
          CodigoError.ReporteConflicto,
          'Ese reporte ya se cerró con otra hora',
        );
      }

      exigirHora(validarCierre(fin, fila.inicioEn, this.reloj()));

      const [cerrado] = await tx
        .update(reportes)
        .set({ finEn: fin, cerradoRecibidoEn: sql`now()` })
        .where(eq(reportes.id, id))
        .returning();
      await this.consenso.reevaluar(tx, cerrado.sectorId, cerrado.tipoServicio);
      return aReporteDto(cerrado);
    });
  }

  /**
   * Los reportes del propio residente, el más reciente primero: para que el cliente recupere su
   * estado en otro dispositivo. Con `abiertos`, solo los que siguen sin cierre y no vencidos. Nunca
   * devuelve reportes ajenos.
   */
  async mios(perfil: PerfilResidente, soloAbiertos: boolean): Promise<ReporteDto[]> {
    const filas = await this.db
      .select()
      .from(reportes)
      .where(
        soloAbiertos
          ? and(
              eq(reportes.residenteId, perfil.id),
              isNull(reportes.finEn),
              eq(reportes.vencido, false),
            )
          : eq(reportes.residenteId, perfil.id),
      )
      .orderBy(desc(reportes.inicioEn))
      .limit(LIMITE_MIOS);
    return filas.map(aReporteDto);
  }

  /** Un reporte por id, sin filtrar por dueño (el llamador decide qué hacer con uno ajeno). */
  async buscar(tx: BaseDeDatos | Transaccion, id: string): Promise<FilaReporte | undefined> {
    const [fila] = await tx.select().from(reportes).where(eq(reportes.id, id)).limit(1);
    return fila;
  }
}
