import { Inject, Injectable } from '@nestjs/common';
import { asc, eq, sql } from 'drizzle-orm';
import type { GeometriaMultiPoligonoDto, SectoresGeoJsonDto, ZonaDto } from '@blackout/shared';
import { type BaseDeDatos, DB } from '../db/db.module';
import { municipios, sectores } from '../db/schema';

/** Tolerancia de la simplificación del contorno de la zona, en grados (unos 30 m). */
const TOLERANCIA_CONTORNO = 0.0003;

@Injectable()
export class SectoresService {
  /** El contorno solo cambia con un nuevo `db:seed`, que exige reiniciar la API: se calcula una vez. */
  private contornoEnCurso?: Promise<ZonaDto>;

  constructor(@Inject(DB) private readonly db: BaseDeDatos) {}

  /**
   * Los sectores como un FeatureCollection GeoJSON (VIS-01). La geometría sale de `ST_AsGeoJSON`
   * (coordenadas `[lng, lat]`). Solo trae el hexágono de cada sector: nada de residentes (NF-06).
   */
  async geojson(): Promise<SectoresGeoJsonDto> {
    const filas = await this.db
      .select({
        id: sectores.id,
        nombre: sectores.nombre,
        municipio: municipios.nombre,
        geometria: sql<string>`ST_AsGeoJSON(${sectores.geom})`,
      })
      .from(sectores)
      .innerJoin(municipios, eq(municipios.id, sectores.municipioId))
      .orderBy(asc(sectores.id));
    return {
      type: 'FeatureCollection',
      features: filas.map((f) => ({
        type: 'Feature',
        id: f.id,
        properties: { id: f.id, nombre: f.nombre, municipio: f.municipio },
        geometry: JSON.parse(f.geometria) as GeometriaMultiPoligonoDto,
      })),
    };
  }

  /**
   * La zona de cobertura (D-040): la unión de los municipios, simplificada para el mapa. La unión
   * borra los bordes internos, así que la máscara no muestra rendijas entre municipios.
   */
  contorno(): Promise<ZonaDto> {
    this.contornoEnCurso ??= this.calcularContorno().catch((error: unknown) => {
      this.contornoEnCurso = undefined;
      throw error;
    });
    return this.contornoEnCurso;
  }

  private async calcularContorno(): Promise<ZonaDto> {
    const [fila] = await this.db
      .select({
        geometria: sql<
          string | null
        >`ST_AsGeoJSON(ST_Multi(ST_SimplifyPreserveTopology(ST_Union(${municipios.geom}), ${TOLERANCIA_CONTORNO})), 6)`,
        nombres: sql<string[] | null>`array_agg(${municipios.nombre} order by ${municipios.id})`,
      })
      .from(municipios);
    if (!fila?.geometria) throw new Error('No hay municipios: corre antes `pnpm db:seed`');
    return {
      type: 'Feature',
      properties: { municipios: fila.nombres ?? [] },
      geometry: JSON.parse(fila.geometria) as GeometriaMultiPoligonoDto,
    };
  }
}
