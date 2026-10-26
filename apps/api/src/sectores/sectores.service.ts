import { Inject, Injectable } from '@nestjs/common';
import { asc, sql } from 'drizzle-orm';
import type { GeometriaMultiPoligonoDto, SectoresGeoJsonDto } from '@blackout/shared';
import { type BaseDeDatos, DB } from '../db/db.module';
import { sectores } from '../db/schema';

@Injectable()
export class SectoresService {
  constructor(@Inject(DB) private readonly db: BaseDeDatos) {}

  /**
   * Los sectores como un FeatureCollection GeoJSON (VIS-01). La geometría sale de `ST_AsGeoJSON`
   * (coordenadas `[lng, lat]`). Solo trae el polígono de cada sector: nada de residentes (NF-06).
   */
  async geojson(): Promise<SectoresGeoJsonDto> {
    const filas = await this.db
      .select({
        id: sectores.id,
        nombre: sectores.nombre,
        geometria: sql<string>`ST_AsGeoJSON(${sectores.geom})`,
      })
      .from(sectores)
      .orderBy(asc(sectores.id));
    return {
      type: 'FeatureCollection',
      features: filas.map((f) => ({
        type: 'Feature',
        id: f.id,
        properties: { id: f.id, nombre: f.nombre },
        geometry: JSON.parse(f.geometria) as GeometriaMultiPoligonoDto,
      })),
    };
  }
}
