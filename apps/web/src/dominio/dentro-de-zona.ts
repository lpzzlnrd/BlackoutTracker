import type { PinDto, ZonaDto } from '@blackout/shared';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';

/**
 * Si el pin cae dentro de la Gran Valencia, en el cliente (D-040). Es solo el aviso inmediato: el
 * contorno viene simplificado (unos 30 m) y el servidor decide con el límite exacto (`ST_Covers`),
 * que además dice en qué hexágono queda. Turf, con su valor por defecto, incluye el borde, como
 * `ST_Covers` (REG-03, D-002).
 */
export function dentroDeZona(zona: ZonaDto, pin: PinDto): boolean {
  return booleanPointInPolygon([pin.lng, pin.lat], zona.geometry); // GeoJSON: longitud primero
}
