import type { Sql } from 'postgres';
import { TIPOS_SERVICIO } from '@blackout/shared';

export interface SectorSembrado {
  nombre: string;
  /** Siempre MultiPolygon: un Polygon se envuelve. */
  geometria: { type: 'MultiPolygon'; coordinates: number[][][][] };
}

/** Valida la forma del GeoJSON de sectores (sin base de datos). Lanza con un mensaje claro. */
export function leerSectores(geojson: unknown): SectorSembrado[] {
  const fc = geojson as { type?: string; features?: unknown };
  if (fc?.type !== 'FeatureCollection' || !Array.isArray(fc.features)) {
    throw new Error('El GeoJSON de sectores debe ser un FeatureCollection');
  }
  if (fc.features.length === 0) throw new Error('El GeoJSON de sectores no tiene ningún sector');

  const nombres = new Set<string>();
  return fc.features.map((f: unknown, i) => {
    const feature = f as {
      properties?: { nombre?: unknown };
      geometry?: { type?: string; coordinates?: unknown };
    };
    const nombre = feature?.properties?.nombre;
    if (typeof nombre !== 'string' || nombre.trim() === '') {
      throw new Error(`El sector #${i + 1} no tiene properties.nombre`);
    }
    if (nombres.has(nombre)) throw new Error(`Nombre de sector repetido: "${nombre}"`);
    nombres.add(nombre);

    const g = feature.geometry;
    if (g?.type === 'MultiPolygon' && Array.isArray(g.coordinates)) {
      return { nombre, geometria: { type: 'MultiPolygon', coordinates: g.coordinates } };
    }
    if (g?.type === 'Polygon' && Array.isArray(g.coordinates)) {
      return { nombre, geometria: { type: 'MultiPolygon', coordinates: [g.coordinates] } };
    }
    throw new Error(`"${nombre}": la geometría debe ser Polygon o MultiPolygon`);
  });
}

export interface ResultadoSiembra {
  sectores: number;
  filasEstado: number;
}

/**
 * Inserta (o actualiza por nombre) los sectores y crea las filas de `estado_sector` (sector × servicio).
 * Es idempotente: se puede volver a correr cuando cambia el GeoJSON. Corre en una transacción y
 * falla, sin guardar nada, si una geometría no es válida o si dos sectores se solapan (compartir
 * solo el borde está bien).
 */
export async function sembrarSectores(
  sql: Sql,
  sectores: SectorSembrado[],
): Promise<ResultadoSiembra> {
  return sql.begin(async (tx) => {
    for (const s of sectores) {
      await tx`
        insert into sectores (nombre, geom)
        values (${s.nombre}, st_multi(st_setsrid(st_geomfromgeojson(${JSON.stringify(s.geometria)}), 4326)))
        on conflict (nombre) do update set geom = excluded.geom`;
    }

    const invalidos = await tx`
      select nombre, st_isvalidreason(geom) as motivo from sectores
      where nombre = any(${sectores.map((s) => s.nombre)}) and not st_isvalid(geom)`;
    if (invalidos.length > 0) {
      throw new Error(
        `Geometría inválida: ${invalidos.map((r) => `${String(r.nombre)} (${String(r.motivo)})`).join('; ')}`,
      );
    }

    const solapes = await tx`
      select a.nombre as a, b.nombre as b from sectores a
      join sectores b on a.id < b.id and a.geom && b.geom
      where st_area(st_intersection(a.geom, b.geom)) > 0`;
    if (solapes.length > 0) {
      throw new Error(
        `Sectores solapados: ${solapes.map((r) => `${String(r.a)} y ${String(r.b)}`).join('; ')}`,
      );
    }

    await tx`
      insert into estado_sector (sector_id, tipo_servicio)
      select s.id, t.tipo::tipo_servicio from sectores s cross join unnest(${[...TIPOS_SERVICIO]}::text[]) as t(tipo)
      on conflict do nothing`;

    const [{ total }] = await tx`select count(*)::int as total from estado_sector`;
    return { sectores: sectores.length, filasEstado: Number(total) };
  });
}
