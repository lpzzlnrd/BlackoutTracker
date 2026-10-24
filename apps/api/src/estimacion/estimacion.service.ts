import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, isNotNull, sql } from 'drizzle-orm';
import { CodigoError, type EstimacionDto, type TipoServicio } from '@blackout/shared';
import { ErrorNegocio } from '../comun/error-negocio';
import type { Env } from '../config/env';
import { type BaseDeDatos, DB } from '../db/db.module';
import { eventosSector, sectores } from '../db/schema';
import { type DatosEstimacion, resumir } from './estadistica.puro';

/**
 * Estimación estadística de la duración de un corte (docs/PLAN.md §6.4, D-008). Universo: los
 * eventos de sector cerrados, de un solo (sector, servicio): agua y luz no se mezclan (EST-05) y
 * los abiertos quedan fuera. La mediana y los cuartiles se calculan en SQL con `percentile_cont`;
 * `resumir` (puro) aplica n_min. Se recalcula en cada consulta, así que un cierre nuevo entra
 * solo (EST-06). Nunca toca coordenadas.
 */
@Injectable()
export class EstimacionService {
  constructor(
    @Inject(DB) private readonly db: BaseDeDatos,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async estimar(sectorId: number, tipoServicio: TipoServicio): Promise<EstimacionDto> {
    const [sector] = await this.db
      .select({ id: sectores.id })
      .from(sectores)
      .where(eq(sectores.id, sectorId));
    if (!sector) throw new ErrorNegocio(CodigoError.SectorNoEncontrado, 'El sector no existe');

    return resumir(
      await this.datos(sectorId, tipoServicio),
      this.config.get('ESTIMACION_N_MIN', { infer: true }),
    );
  }

  /** Agregados en minutos de los ciclos completos. Sin ciclos: n = 0 y `percentile_cont` da null. */
  private async datos(sectorId: number, tipoServicio: TipoServicio): Promise<DatosEstimacion> {
    const minutos = sql`extract(epoch from (${eventosSector.finEn} - ${eventosSector.inicioEn})) / 60.0`;
    const percentil = (p: number) =>
      sql<number | null>`(percentile_cont(${p}) within group (order by ${minutos}))::float8`;

    const [fila] = await this.db
      .select({
        n: sql<number>`count(*)::int`,
        mediana: percentil(0.5),
        q1: percentil(0.25),
        q3: percentil(0.75),
      })
      .from(eventosSector)
      .where(
        and(
          eq(eventosSector.sectorId, sectorId),
          eq(eventosSector.tipoServicio, tipoServicio),
          isNotNull(eventosSector.finEn),
        ),
      );
    return fila;
  }
}
