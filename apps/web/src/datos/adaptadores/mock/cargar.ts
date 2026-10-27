import type { GeometriaMultiPoligonoDto, SectoresGeoJsonDto } from '@blackout/shared';
import { crearPuertosDemo, type OpcionesDemo, type PuertosDemo } from './demo';
import type { DatosEjemplo } from './escenario';

/** Forma del GeoJSON semilla de `data/` (T-012): sin `id`, con los nombres provisionales. */
interface GeoJsonSemilla {
  features: { geometry: GeometriaMultiPoligonoDto }[];
}

/**
 * La geometría no está en `datos-ejemplo.json`: se toma de la cuadrícula de pruebas de `data/`
 * (`sectores-cuadricula.geojson`, D-036) y se le ponen los ids y nombres de los sectores de ejemplo,
 * en el mismo orden.
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
              properties: { id: sector.id, nombre: sector.nombre },
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
  const [ejemplo, semilla] = await Promise.all([
    import('@docs/frontend/datos-ejemplo.json'),
    import('@data/sectores-cuadricula.geojson?raw'),
  ]);
  const datos = ejemplo.default as unknown as DatosEjemplo;
  const geoJson = geoJsonDemo(datos.sectores, JSON.parse(semilla.default) as GeoJsonSemilla);
  return crearPuertosDemo(datos, geoJson, opciones);
}
