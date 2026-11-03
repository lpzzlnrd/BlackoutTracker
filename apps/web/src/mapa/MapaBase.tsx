import 'leaflet/dist/leaflet.css';
import '../estilos/mapa.css';
import type { SectoresGeoJsonDto, ZonaDto } from '@blackout/shared';
import {
  geoJSON,
  latLngBounds,
  type LatLngBounds,
  type LatLngTuple,
  type Map as MapaLeaflet,
} from 'leaflet';
import { useMemo, type ReactNode, type Ref } from 'react';
import { MapContainer, Polygon, TileLayer } from 'react-leaflet';

// Base común de todos los mapas (CANON §4.1): coropleta (S2) y elección del pin (registro, S1).
// Sin controles de Leaflet: la atribución es un elemento propio, hermano del mapa.

/**
 * El casco urbano de la Gran Valencia, de Tocuyito a Los Guayos y del sur de la ciudad a
 * Naguanagua (D-040). Es el encuadre de partida: los cinco municipios llegan hasta el lago y la
 * cordillera, y el mapa entero dejaría cada hexágono en unos pocos píxeles.
 */
export const CASCO_URBANO: [[number, number], [number, number]] = [
  [10.09, -68.1],
  [10.3, -67.9],
];

/** El encuadre de la Gran Valencia: el casco urbano, ampliado si algún sector queda fuera. */
export function limitesDe(sectores: SectoresGeoJsonDto | undefined): LatLngBounds {
  const limites = latLngBounds(CASCO_URBANO);
  return sectores?.features.length ? limites.extend(geoJSON(sectores).getBounds()) : limites;
}

export function MapaBase({
  limites,
  relleno,
  etiqueta,
  refMapa,
  children,
}: {
  limites: LatLngBounds;
  /** `paddingTopLeft` / `paddingBottomRight` del encuadre inicial (deja sitio a la hoja, A §3). */
  relleno?: { arribaIzquierda: [number, number]; abajoDerecha: [number, number] };
  /** `aria-label` del mapa (CANON §4.6): "Mapa de sectores: Sector 1 sin servicio, …". */
  etiqueta: string;
  /** La instancia de Leaflet, para controles que viven fuera del mapa ("Ver toda la Gran Valencia"). */
  refMapa?: Ref<MapaLeaflet>;
  children?: ReactNode;
}) {
  return (
    <div role="img" aria-label={etiqueta} className="absolute inset-0">
      <MapContainer
        ref={refMapa}
        bounds={limites}
        boundsOptions={{
          paddingTopLeft: relleno?.arribaIzquierda ?? [16, 16],
          paddingBottomRight: relleno?.abajoDerecha ?? [16, 16],
        }}
        // Zoom fraccionario: con pasos enteros, en un teléfono pequeño el encuadre salta a un nivel
        // en el que los sectores quedan diminutos.
        zoomSnap={0.25}
        zoomControl={false}
        attributionControl={false}
        className="h-full w-full"
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
          className="teselas"
        />
        {children}
      </MapContainer>
    </div>
  );
}

/** Atribución obligatoria y siempre visible (CANON §4.1). Va fuera del mapa, encima. */
export function AtribucionOSM({ className = '' }: { className?: string }) {
  return (
    <p
      className={`z-[1000] rounded-[4px] bg-superficie/85 px-1.5 py-0.5 text-xs text-texto-2 ${className}`}
    >
      ©{' '}
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer"
        className="underline"
      >
        OpenStreetMap
      </a>{' '}
      contributors
    </p>
  );
}

/** El mundo entero, hasta donde llega la proyección de las teselas. */
const MUNDO: LatLngTuple[] = [
  [85, -180],
  [85, 180],
  [-85, 180],
  [-85, -180],
];

/**
 * Fuera de la Gran Valencia el mapa se apaga hacia su fondo (D-035, D-040): un rectángulo del mundo
 * con un hueco por cada pieza del contorno de la zona. Leaflet rellena con `evenodd`, así que cada
 * anillo exterior es un hueco (y un hueco del contorno, si lo hubiera, vuelve a quedar tapado).
 */
export function Mascara({ zona }: { zona: ZonaDto }) {
  const anillos = useMemo(
    () => [
      MUNDO,
      ...zona.geometry.coordinates.flatMap((poligono) =>
        poligono.map((anillo) => anillo.map(([lng = 0, lat = 0]): LatLngTuple => [lat, lng])),
      ),
    ],
    [zona],
  );
  return <Polygon positions={anillos} className="mascara" interactive={false} />;
}

/** La trama de "sin confirmar", una sola vez por página (CANON §4.2). */
export function DefinicionesMapa() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <pattern
          id="trama"
          width="7"
          height="7"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="7" height="7" className="trama-fondo" />
          <line x1="0" y1="0" x2="0" y2="7" strokeWidth="2" className="trama-linea" />
        </pattern>
      </defs>
    </svg>
  );
}
