import type { GeometriaMultiPoligonoDto, SectoresGeoJsonDto, ZonaDto } from '@blackout/shared';
import { crearPuertosDemo, type OpcionesDemo, type PuertosDemo } from './demo';
import type { DatosEjemplo } from './escenario';

/** Forma del GeoJSON semilla de `data/` (D-040): los hexágonos, sin `id` ni nombre. */
interface GeoJsonSemilla {
  features: { geometry: GeometriaMultiPoligonoDto }[];
}

/**
 * La geometría no está en `datos-ejemplo.json`: se toma de los 4 hexágonos de `data/`
 * (`sectores-demo.geojson`, D-040) y se le ponen los ids y nombres de los sectores de ejemplo, en
 * el mismo orden.
 */
export function geoJsonDemo(
  sectores: DatosEjemplo['sectores'],
  semilla: GeoJsonSemilla,
): SectoresGeoJsonDto {
  return {
    type: 'FeatureCollection',
    features: sectores.flatMap((sector, i) => {
      const origen = semilla.features[i];
      return origen
        ? [
            {
              type: 'Feature' as const,
              id: sector.id,
              properties: { id: sector.id, nombre: sector.nombre, municipio: 'Valencia' },
              geometry: origen.geometry,
            },
          ]
        : [];
    }),
  };
}

/**
 * Único punto de la demo que toca archivos del repo. Las importaciones son dinámicas: el JSON y
 * todo `mock/` salen en un chunk aparte que la build de producción nunca descarga, salvo que
 * alguien abra la app con `?demo=`.
 */
export async function cargarPuertosDemo(opciones: OpcionesDemo): Promise<PuertosDemo> {
  const [ejemplo, semilla, contorno] = await Promise.all([
    import('@docs/frontend/datos-ejemplo.json'),
    import('@data/sectores-demo.geojson?raw'),
    import('@data/zona-gran-valencia.contorno.geojson?raw'),
  ]);
  const datos = ejemplo.default as unknown as DatosEjemplo;
  const geoJson = geoJsonDemo(datos.sectores, JSON.parse(semilla.default) as GeoJsonSemilla);
  const { type, properties, geometry } = JSON.parse(contorno.default) as ZonaDto;
  return crearPuertosDemo(datos, geoJson, { type, properties, geometry }, opciones);
}
