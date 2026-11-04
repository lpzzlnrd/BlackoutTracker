import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resvg } from '@resvg/resvg-js';
import { and, eq, inArray } from 'drizzle-orm';
import { gridDisk } from 'h3-js';
import { CodigoError, EstadoServicio, type TipoServicio } from '@blackout/shared';
import { ErrorNegocio } from '../comun/error-negocio';
import type { Env } from '../config/env';
import { type BaseDeDatos, DB } from '../db/db.module';
import { estadoSector, sectores } from '../db/schema';
import { ANCHO_IMAGEN, type CeldaImagen, type EstadoCelda, svgVecindario } from './imagen.puro';

/**
 * La imagen del hexágono y sus vecinos (D-042, idea b). La pide el sistema del teléfono al mostrar
 * la notificación, sin sesión: muestra lo mismo que el mapa público (D-029), nunca personas.
 */
@Injectable()
export class ImagenSectorService {
  constructor(
    private readonly config: ConfigService<Env, true>,
    @Inject(DB) private readonly db: BaseDeDatos,
  ) {}

  /**
   * URL absoluta de la imagen, o `null` si no se configuró `API_URL_PUBLICA`. `v` cambia cada minuto
   * para que el teléfono no reutilice la imagen de un estado anterior.
   */
  url(sectorId: number, tipoServicio: TipoServicio, ahora: Date): string | null {
    const base = this.config.get('API_URL_PUBLICA', { infer: true });
    if (!base) return null;
    const v = Math.floor(ahora.getTime() / 60_000);
    return `${base.replace(/\/+$/, '')}/api/notificaciones/imagen/${sectorId}/${tipoServicio}?v=${v}`;
  }

  /** El PNG (720 × 360). 404 `SECTOR_NO_ENCONTRADO` si el sector no existe. */
  async png(sectorId: number, tipoServicio: TipoServicio): Promise<Buffer> {
    const [sector] = await this.db
      .select({ celda: sectores.celdaH3 })
      .from(sectores)
      .where(eq(sectores.id, sectorId))
      .limit(1);
    if (!sector) throw new ErrorNegocio(CodigoError.SectorNoEncontrado, 'El sector no existe');

    const disco = gridDisk(sector.celda, 1);
    const filas = await this.db
      .select({
        celda: sectores.celdaH3,
        estado: estadoSector.estado,
        sinConfirmar: estadoSector.reportesSinConfirmar,
      })
      .from(sectores)
      .leftJoin(
        estadoSector,
        and(eq(estadoSector.sectorId, sectores.id), eq(estadoSector.tipoServicio, tipoServicio)),
      )
      .where(inArray(sectores.celdaH3, disco));
    const porCelda = new Map(filas.map((f) => [f.celda, f]));

    const celdas: CeldaImagen[] = disco.map((celda) => {
      const f = porCelda.get(celda);
      // Un sector sin fila en `estado_sector` nunca tuvo reportes de ese servicio: tiene servicio.
      let estado: EstadoCelda = 'sin-datos';
      if (f) {
        estado =
          f.estado === EstadoServicio.SinServicio
            ? 'sin-servicio'
            : (f.sinConfirmar ?? 0) > 0
              ? 'sin-confirmar'
              : 'con-servicio';
      }
      return { celda, estado, propio: celda === sector.celda };
    });

    const svg = svgVecindario(celdas, tipoServicio);
    return new Resvg(svg, { fitTo: { mode: 'width', value: ANCHO_IMAGEN } }).render().asPng();
  }
}
