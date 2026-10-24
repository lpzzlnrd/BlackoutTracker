import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNotNull, sql } from 'drizzle-orm';
import { CodigoError, type EventoSectorDto, type HistorialDto } from '@blackout/shared';
import { ErrorNegocio } from '../comun/error-negocio';
import { type BaseDeDatos, DB } from '../db/db.module';
import { eventosSector, sectores } from '../db/schema';
import { duracionMin } from '../reportes/tiempo.puro';
import { codificarCursor, decodificarCursor } from './cursor.puro';
import { HISTORIAL_LIMITE_POR_DEFECTO, type HistorialQueryDto } from './dto/historial.dto';

type FilaCerrada = typeof eventosSector.$inferSelect & { finEn: Date };

function aEventoDto(fila: FilaCerrada): EventoSectorDto {
  return {
    id: fila.id,
    sectorId: fila.sectorId,
    tipoServicio: fila.tipoServicio,
    inicioEn: fila.inicioEn.toISOString(),
    finEn: fila.finEn.toISOString(),
    duracionMin: duracionMin(fila.inicioEn, fila.finEn),
    confirmadoEn: fila.confirmadoEn.toISOString(),
    origen: fila.origen,
  };
}

@Injectable()
export class HistorialService {
  constructor(@Inject(DB) private readonly db: BaseDeDatos) {}

  /** Eventos cerrados del sector, el de fin más reciente primero, paginados por cursor. */
  async listar(sectorId: number, query: HistorialQueryDto): Promise<HistorialDto> {
    const posicion = query.cursor === undefined ? null : decodificarCursor(query.cursor);
    if (query.cursor !== undefined && !posicion) {
      throw new ErrorNegocio(CodigoError.DatosInvalidos, 'El cursor no es válido.');
    }
    const limite = query.limite ?? HISTORIAL_LIMITE_POR_DEFECTO;

    const [sector] = await this.db
      .select({ id: sectores.id })
      .from(sectores)
      .where(eq(sectores.id, sectorId));
    if (!sector) throw new ErrorNegocio(CodigoError.SectorNoEncontrado, 'El sector no existe.');

    // Se compara a milisegundos: es la precisión del cursor (y la de todo lo que escribe la API).
    const finMs = sql`date_trunc('milliseconds', ${eventosSector.finEn})`;
    const filas = await this.db
      .select()
      .from(eventosSector)
      .where(
        and(
          eq(eventosSector.sectorId, sectorId),
          isNotNull(eventosSector.finEn),
          query.tipoServicio ? eq(eventosSector.tipoServicio, query.tipoServicio) : undefined,
          posicion
            ? sql`(${finMs}, ${eventosSector.id}) < (${posicion.finEn.toISOString()}::timestamptz, ${posicion.id})`
            : undefined,
        ),
      )
      .orderBy(desc(finMs), desc(eventosSector.id))
      .limit(limite + 1);

    const pagina = filas.slice(0, limite) as FilaCerrada[];
    const ultimo = pagina[pagina.length - 1];
    return {
      eventos: pagina.map(aEventoDto),
      siguienteCursor:
        filas.length > limite && ultimo
          ? codificarCursor({ finEn: ultimo.finEn, id: ultimo.id })
          : null,
    };
  }
}
