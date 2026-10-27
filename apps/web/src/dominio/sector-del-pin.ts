import type { PinDto, SectoresGeoJsonDto } from '@blackout/shared';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';

export interface SectorDelPin {
  id: number;
  nombre: string;
}

/**
 * En qué sector cae el pin, en el cliente (el servidor lo vuelve a comprobar con `ST_Covers`).
 * Turf con su valor por defecto incluye el borde, como `ST_Covers`, y un pin sobre el límite entre
 * dos sectores va al de menor id (D-002): así cliente y servidor dicen siempre lo mismo (REG-03).
 * `null` si cae fuera de Guaparo (REG-02).
 */
export function sectorDelPin(sectores: SectoresGeoJsonDto, pin: PinDto): SectorDelPin | null {
  const punto: [number, number] = [pin.lng, pin.lat]; // GeoJSON: longitud primero
  const ordenados = [...sectores.features].sort((a, b) => a.properties.id - b.properties.id);
  const sector = ordenados.find((f) => booleanPointInPolygon(punto, f.geometry));
  return sector ? { id: sector.properties.id, nombre: sector.properties.nombre } : null;
}
