import type { SectoresGeoJsonDto, TipoServicio } from '@blackout/shared';
import type { SectorFeatureDto } from '@blackout/shared';
import {
  divIcon,
  geoJSON,
  point,
  type LatLngTuple,
  type Layer,
  type Map as MapaLeaflet,
  type PathOptions,
} from 'leaflet';
import { useEffect, useMemo, useRef, useState } from 'react';
import { GeoJSON, Marker, Pane, Polygon, useMap, useMapEvents } from 'react-leaflet';
import type { EstadoSector } from '../dominio/tipos';
import { puntoEtiqueta } from './geometria';
import { useEsEscritorio } from './HojaSector';
import { limitesDe } from './MapaBase';
import { marcadorSector, medidaMarcador, TAMANO_NOMBRE } from './marcador';
import { estadoDeSector, nombreEnMapa } from './textos';

/** Espacio que tapan las superposiciones, como puntos de Leaflet: `[x, y]` en píxeles. */
export interface Relleno {
  arribaIzquierda: [number, number];
  abajoDerecha: [number, number];
}

/**
 * La coropleta (CANON §4): fuera de Guaparo, la máscara; un polígono por sector con la clase de su
 * estado; el contorno grueso del sector elegido y, encima, etiqueta + insignia de cada uno. Vive
 * dentro del `MapContainer`.
 */
export function CapaSectores({
  sectores,
  estados,
  servicio,
  seleccionado,
  propio,
  relleno,
  onSeleccionar,
}: {
  sectores: SectoresGeoJsonDto;
  estados: readonly EstadoSector[] | undefined;
  servicio: TipoServicio;
  seleccionado: number | undefined;
  propio: number | undefined;
  relleno: Relleno;
  onSeleccionar: (sectorId: number) => void;
}) {
  // Leaflet aplica `className` solo al crear cada trazo (setStyle no lo cambia): cuando cambia un
  // estado (Realtime, VIS-03) la capa se vuelve a crear con una clave nueva.
  const firma = sectores.features
    .map((f) => estadoDeSector(estados, f.properties.id, servicio))
    .join('|');

  // El clic se lee de una referencia: la capa no se recrea al cambiar la selección.
  const alSeleccionar = useRef(onSeleccionar);
  useEffect(() => {
    alSeleccionar.current = onSeleccionar;
  });

  // Se vuelve a dibujar en cada zoom: el tamaño en pantalla decide si cabe el nombre.
  const mapa = useMap();
  const [, setZoom] = useState(() => mapa.getZoom());
  useMapEvents({ zoomend: () => setZoom(mapa.getZoom()) });
  const tamanoNombre = useEsEscritorio() ? TAMANO_NOMBRE.escritorio : TAMANO_NOMBRE.telefono;

  const contorno = useMemo<SectoresGeoJsonDto | null>(() => {
    const elegido = sectores.features.find((f) => f.properties.id === seleccionado);
    return elegido ? { type: 'FeatureCollection', features: [elegido] } : null;
  }, [sectores, seleccionado]);

  return (
    <>
      <Encuadre sectores={sectores} relleno={relleno} />
      <Mascara sectores={sectores} />
      <GeoJSON
        key={`${servicio}:${firma}`}
        data={sectores}
        style={(feature): PathOptions => ({
          className: `sector sector--${estadoDeSector(estados, Number(feature?.properties?.id), servicio)}`,
        })}
        onEachFeature={(feature, capa: Layer) => {
          capa.on('click', () => alSeleccionar.current(Number(feature.properties?.id)));
        }}
      />
      {/* En su propio panel, encima de los estados: esa capa se recrea con cada cambio y, en el
          mismo SVG, quedaría dibujada sobre el contorno. */}
      <Pane name="contorno" style={{ zIndex: 450 }}>
        {contorno && (
          <GeoJSON
            key={`contorno:${seleccionado}`}
            data={contorno}
            interactive={false}
            style={{ className: 'sector-contorno' }}
          />
        )}
      </Pane>
      {sectores.features.map((sector) => {
        const nombre = nombreEnMapa(sector.properties.nombre);
        const esPropio = sector.properties.id === propio;
        return (
          <MarcadorSector
            key={sector.properties.id}
            posicion={puntoEtiqueta(sector)}
            nombre={nombre}
            estado={estadoDeSector(estados, sector.properties.id, servicio)}
            propio={esPropio}
            compacto={!cabeEn(mapa, sector, medidaMarcador(nombre, esPropio, tamanoNombre))}
          />
        );
      })}
    </>
  );
}

/** Si el marcador completo cabe en el sector tal como se ve ahora; si no, va solo la insignia. */
const cabeEn = (
  mapa: MapaLeaflet,
  sector: SectorFeatureDto,
  { ancho, alto }: { ancho: number; alto: number },
): boolean => {
  const limites = geoJSON(sector).getBounds();
  const noreste = mapa.latLngToContainerPoint(limites.getNorthEast());
  const suroeste = mapa.latLngToContainerPoint(limites.getSouthWest());
  return noreste.x - suroeste.x >= ancho && suroeste.y - noreste.y >= alto;
};

function MarcadorSector({
  posicion,
  nombre,
  estado,
  propio,
  compacto,
}: {
  posicion: [number, number];
  nombre: string;
  estado: ReturnType<typeof estadoDeSector>;
  propio: boolean;
  compacto: boolean;
}) {
  const icono = useMemo(() => {
    const { html, tamano, ancla } = marcadorSector({ nombre, estado, propio, compacto });
    return divIcon({ html, iconSize: tamano, iconAnchor: ancla, className: 'icono-mapa' });
  }, [nombre, estado, propio, compacto]);
  // Sin interacción: los toques pasan al polígono de debajo.
  return <Marker position={posicion} icon={icono} interactive={false} keyboard={false} />;
}

/** El mundo entero, hasta donde llega la proyección de las teselas. */
const MUNDO: LatLngTuple[] = [
  [85, -180],
  [85, 180],
  [-85, 180],
  [-85, -180],
];

/**
 * Fuera de Guaparo el mapa se apaga hacia su fondo (D-035): un rectángulo del mundo con un hueco
 * por sector. Leaflet rellena con `evenodd`, así que cada anillo exterior de un sector es un hueco.
 */
function Mascara({ sectores }: { sectores: SectoresGeoJsonDto }) {
  const anillos = useMemo(
    () => [
      MUNDO,
      ...sectores.features.flatMap((sector) =>
        sector.geometry.coordinates.map(([exterior = []]) =>
          exterior.map(([lng = 0, lat = 0]): LatLngTuple => [lat, lng]),
        ),
      ),
    ],
    [sectores],
  );
  return <Polygon positions={anillos} className="mascara" interactive={false} />;
}

/**
 * Encuadra los sectores dejando libre lo que tapan las superposiciones. Tampoco deja alejarse más
 * de un nivel de ese encuadre ni irse lejos: más allá, Guaparo queda como un punto en Valencia.
 */
export function encuadrar(mapa: MapaLeaflet, sectores: SectoresGeoJsonDto, relleno: Relleno) {
  const limites = limitesDe(sectores);
  const { arribaIzquierda, abajoDerecha } = relleno;
  const holgura = point(arribaIzquierda).add(abajoDerecha);
  mapa.setMinZoom(mapa.getBoundsZoom(limites, false, holgura) - 1);
  mapa.setMaxBounds(limites.pad(2));
  mapa.fitBounds(limites, { paddingTopLeft: arribaIzquierda, paddingBottomRight: abajoDerecha });
}

/** Encuadra al cargar los sectores y cuando cambia el espacio libre (teléfono ↔ escritorio). */
function Encuadre({ sectores, relleno }: { sectores: SectoresGeoJsonDto; relleno: Relleno }) {
  const mapa = useMap();
  const [izquierda, arriba] = relleno.arribaIzquierda;
  const [derecha, abajo] = relleno.abajoDerecha;
  useEffect(() => {
    encuadrar(mapa, sectores, {
      arribaIzquierda: [izquierda, arriba],
      abajoDerecha: [derecha, abajo],
    });
  }, [mapa, sectores, izquierda, arriba, derecha, abajo]);
  return null;
}
