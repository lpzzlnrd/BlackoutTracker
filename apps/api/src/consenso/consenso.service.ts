import { Injectable } from '@nestjs/common';
import type { TipoServicio } from '@blackout/shared';
import type { Transaccion } from '../db/db.module';

/**
 * Punto de enganche del consenso. Hasta T-032 no hace nada: `ReportesService` ya lo llama dentro de
 * la misma transacción que escribe el reporte, así que T-032 solo reemplaza este cuerpo (lock por
 * sector y servicio, funciones puras, evento y `estado_sector`) sin tocar los reportes.
 */
@Injectable()
export class ConsensoService {
  /** Recalcula el estado del par (sector, servicio) tras un inicio o un cierre. */
  async reevaluar(_tx: Transaccion, _sectorId: number, _tipoServicio: TipoServicio): Promise<void> {
    // no-op hasta T-032
  }
}
