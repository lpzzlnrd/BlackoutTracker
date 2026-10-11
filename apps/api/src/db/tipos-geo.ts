import { customType } from 'drizzle-orm/pg-core';

/** SRID de todas las geometrías (WGS 84: lo que entrega el GPS y lo que usa GeoJSON). */
export const SRID = 4326;

/**
 * `geometry(MultiPolygon, 4326)`. Drizzle solo trae el tipo `geometry` para puntos, así que este va
 * como `customType`. Nunca se lee la columna cruda: las consultas pasan por `ST_AsGeoJSON` (helper
 * `sql`), y se escribe con `ST_GeomFromGeoJSON`.
 */
export const multiPoligono = customType<{ data: string; driverData: string }>({
  dataType: () => `geometry(MultiPolygon, ${SRID})`,
});
