import 'leaflet/dist/leaflet.css';
import '../estilos/mapa.css';
import type { SectoresGeoJsonDto } from '@blackout/shared';
import { geoJSON, latLngBounds, type LatLngBounds, type Map as MapaLeaflet } from 'leaflet';
import type { ReactNode, Ref } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';

// Base común de todos los mapas (CANON §4.1): coropleta (S2) y elección del pin (registro, S1).
// Sin controles de Leaflet: la atribución es un elemento propio, hermano del mapa.

/** Encuadre de todos los sectores; Guaparo aproximado mientras no hay geometría. */
export function limitesDe(sectores: SectoresGeoJsonDto | undefined): LatLngBounds {
  if (!sectores?.features.length) {
    return latLngBounds([
      [10.195, -68.02],
      [10.215, -67.995],
    ]);
  }
  return geoJSON(sectores).getBounds();
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
  /** La instancia de Leaflet, para controles que viven fuera del mapa ("Ver todo Guaparo"). */
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
