import type { Sql } from 'postgres';

// La zona de cobertura (los municipios) y los lugares con nombre de OSM (T-070, D-040). Los
// sectores ya no se siembran: nacen solos con el primer residente de cada celda H3.

export interface MunicipioSembrado {
  nombre: string;
  /** Siempre MultiPolygon: un Polygon se envuelve. */
  geometria: { type: 'MultiPolygon'; coordinates: number[][][][] };
}

export interface LugarSembrado {
  nombre: string;
  peso: number;
  lng: number;
  lat: number;
}

interface FeatureLeida {
  properties?: Record<string, unknown>;
  geometry?: { type?: string; coordinates?: unknown };
}

function features(geojson: unknown, que: string): FeatureLeida[] {
  const fc = geojson as { type?: string; features?: unknown };
  if (fc?.type !== 'FeatureCollection' || !Array.isArray(fc.features)) {
    throw new Error(`El GeoJSON de ${que} debe ser un FeatureCollection`);
  }
  if (fc.features.length === 0) throw new Error(`El GeoJSON de ${que} está vacío`);
  return fc.features as FeatureLeida[];
}

function nombreDe(f: FeatureLeida, i: number, que: string): string {
  const nombre = f?.properties?.nombre;
  if (typeof nombre !== 'string' || nombre.trim() === '') {
    throw new Error(`${que} #${i + 1} no tiene properties.nombre`);
  }
  return nombre.trim();
}

/** Valida la forma del GeoJSON de la zona (sin base de datos). Lanza con un mensaje claro. */
export function leerZona(geojson: unknown): MunicipioSembrado[] {
  const nombres = new Set<string>();
  return features(geojson, 'la zona').map((f, i) => {
    const nombre = nombreDe(f, i, 'El municipio');
    if (nombres.has(nombre)) throw new Error(`Municipio repetido: "${nombre}"`);
    nombres.add(nombre);
    const g = f.geometry;
    if (g?.type === 'MultiPolygon' && Array.isArray(g.coordinates)) {
      return {
        nombre,
        geometria: { type: 'MultiPolygon', coordinates: g.coordinates as number[][][][] },
      };
    }
    if (g?.type === 'Polygon' && Array.isArray(g.coordinates)) {
      return {
        nombre,
        geometria: { type: 'MultiPolygon', coordinates: [g.coordinates as number[][][]] },
      };
    }
    throw new Error(`"${nombre}": la geometría debe ser Polygon o MultiPolygon`);
  });
}

/** Valida el GeoJSON de lugares: puntos con nombre y un peso positivo (1 si no trae). */
export function leerLugares(geojson: unknown): LugarSembrado[] {
  return features(geojson, 'lugares').map((f, i) => {
    const nombre = nombreDe(f, i, 'El lugar');
    const g = f.geometry;
    const [lng, lat] = Array.isArray(g?.coordinates) ? (g.coordinates as unknown[]) : [];
    if (g?.type !== 'Point' || typeof lng !== 'number' || typeof lat !== 'number') {
      throw new Error(`"${nombre}": la geometría debe ser un Point`);
    }
    const peso = f.properties?.peso ?? 1;
    if (typeof peso !== 'number' || !(peso > 0)) {
      throw new Error(`"${nombre}": el peso debe ser un número positivo`);
    }
    return { nombre, peso, lng, lat };
  });
}

export interface ResultadoSiembra {
  municipios: number;
  lugares: number;
}

/**
 * Inserta (o actualiza por nombre) los municipios y reemplaza los lugares. Es idempotente y corre
 * en una transacción: falla sin guardar nada si un municipio no es válido o si dos se solapan
 * (compartir el borde está bien). Los municipios no se borran: los sectores apuntan a ellos.
 */
export async function sembrarZona(
  sql: Sql,
  municipios: MunicipioSembrado[],
  lugares: LugarSembrado[],
): Promise<ResultadoSiembra> {
  return sql.begin(async (tx) => {
    for (const m of municipios) {
      await tx`
        insert into municipios (nombre, geom)
        values (${m.nombre}, st_multi(st_setsrid(st_geomfromgeojson(${JSON.stringify(m.geometria)}), 4326)))
        on conflict (nombre) do update set geom = excluded.geom`;
    }

    const invalidos = await tx`
      select nombre, st_isvalidreason(geom) as motivo from municipios
      where nombre = any(${municipios.map((m) => m.nombre)}) and not st_isvalid(geom)`;
    if (invalidos.length > 0) {
      throw new Error(
        `Geometría inválida: ${invalidos.map((r) => `${String(r.nombre)} (${String(r.motivo)})`).join('; ')}`,
      );
    }

    // Un área menor que ~1 m² (1e-10 grados²) es ruido del redondeo, no un solape.
    const solapes = await tx`
      select a.nombre as a, b.nombre as b from municipios a
      join municipios b on a.id < b.id and a.geom && b.geom
      where st_area(st_intersection(a.geom, b.geom)) > 1e-10`;
    if (solapes.length > 0) {
      throw new Error(
        `Municipios solapados: ${solapes.map((r) => `${String(r.a)} y ${String(r.b)}`).join('; ')}`,
      );
    }

    await tx`delete from lugares`;
    await tx`
      insert into lugares (nombre, peso, geom)
      select l.nombre, l.peso, st_setsrid(st_makepoint(l.lng, l.lat), 4326)
      from json_to_recordset(${JSON.stringify(lugares)}::text::json)
        as l(nombre text, peso real, lng float8, lat float8)`;

    return { municipios: municipios.length, lugares: lugares.length };
  });
}
