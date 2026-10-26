import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import {
  CodigoError,
  EstadoServicio,
  type ResumenSectorDto,
  type ResumenServicioDto,
  TIPOS_SERVICIO,
  type TipoServicio,
} from '@blackout/shared';
import { ErrorNegocio } from '../comun/error-negocio';
import { ConsensoService } from '../consenso/consenso.service';
import { type BaseDeDatos, DB } from '../db/db.module';
import { estadoSector, eventosSector, sectores } from '../db/schema';
import { EstimacionService } from '../estimacion/estimacion.service';
import { aEventoDto } from '../historial/historial.service';

/** Cuántos eventos recientes trae el resumen por servicio (VIS-04). */
export const RESUMEN_EVENTOS = 5;

/**
 * Resumen de un sector para el panel (VIS-04): por servicio, el estado consolidado, la
 * estimación con su n y los últimos eventos. No calcula nada propio: compone `estado_sector`,
 * `EstimacionService` (T-042) y el mismo mapeo de eventos del historial (T-034). Nunca toca
 * residentes ni coordenadas (NF-06).
 */
@Injectable()
export class ResumenService {
  constructor(
    @Inject(DB) private readonly db: BaseDeDatos,
    private readonly consenso: ConsensoService,
    private readonly estimacion: EstimacionService,
  ) {}

  async resumir(sectorId: number): Promise<ResumenSectorDto> {
    const [sector] = await this.db
      .select({ id: sectores.id, nombre: sectores.nombre })
      .from(sectores)
      .where(eq(sectores.id, sectorId));
    if (!sector) throw new ErrorNegocio(CodigoError.SectorNoEncontrado, 'El sector no existe.');

    // Cada servicio tiene su propio bloqueo en `reevaluar`, así que se pueden resolver a la vez.
    const servicios = await Promise.all(
      TIPOS_SERVICIO.map((tipo) => this.servicio(sectorId, tipo)),
    );
    return { sectorId: sector.id, sectorNombre: sector.nombre, servicios };
  }

  private async servicio(
    sectorId: number,
    tipoServicio: TipoServicio,
  ): Promise<ResumenServicioDto> {
    // Recálculo al leer (T-033, PLAN §6.3): sin esto, una ventana vencida dejaría un "sin
    // confirmar" fantasma si el cron no corrió (Render gratis se duerme).
    await this.consenso.refrescarSiViejo(sectorId, tipoServicio);

    const [estado] = await this.db
      .select()
      .from(estadoSector)
      .where(and(eq(estadoSector.sectorId, sectorId), eq(estadoSector.tipoServicio, tipoServicio)));
    const [estimacion, recientes] = await Promise.all([
      this.estimacion.estimar(sectorId, tipoServicio),
      this.db
        .select()
        .from(eventosSector)
        .where(
          and(eq(eventosSector.sectorId, sectorId), eq(eventosSector.tipoServicio, tipoServicio)),
        )
        .orderBy(desc(eventosSector.inicioEn), desc(eventosSector.id))
        .limit(RESUMEN_EVENTOS),
    ]);

    return {
      tipoServicio,
      // Un par sin fila (nunca hubo reportes) es un sector con servicio y nada pendiente.
      estado: estado?.estado ?? EstadoServicio.ConServicio,
      reportesSinConfirmar: estado?.reportesSinConfirmar ?? 0,
      desde: estado?.desde?.toISOString() ?? null,
      estimacion,
      ultimosEventos: recientes.map(aEventoDto),
    };
  }
}
