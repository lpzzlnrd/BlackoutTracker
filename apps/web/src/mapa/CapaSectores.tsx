import type { SectoresGeoJsonDto, TipoServicio } from '@blackout/shared';
import type { SectorFeatureDto } from '@blackout/shared';
import { divIcon, geoJSON, type Layer, type Map as MapaLeaflet, type PathOptions } from 'leaflet';
import { useEffect, useMemo, useRef, useState } from 'react';
import { GeoJSON, Marker, useMap, useMapEvents } from 'react-leaflet';
import type { EstadoSector } from '../dominio/tipos';
import { puntoEtiqueta } from './geometria';
import { limitesDe } from './MapaBase';
import { marcadorSector } from './marcador';
import { estadoDeSector } from './textos';

/** Espacio que tapan las superposiciones, como puntos de Leaflet: `[x, y]` en píxeles. */
export interface Relleno {
  arribaIzquierda: [number, number];
  abajoDerecha: [number, number];
}

/**
 * La coropleta (CANON §4): un polígono por sector con la clase de su estado, el contorno grueso
 * del sector elegido y, encima, etiqueta + insignia de cada uno. Vive dentro del `MapContainer`.
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

  const contorno = useMemo<SectoresGeoJsonDto | null>(() => {
    const elegido = sectores.features.find((f) => f.properties.id === seleccionado);
    return elegido ? { type: 'FeatureCollection', features: [elegido] } : null;
  }, [sectores, seleccionado]);

  return (
    <>
      <Encuadre sectores={sectores} relleno={relleno} />
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
      {contorno && (
        <GeoJSON
          key={`contorno:${seleccionado}`}
          data={contorno}
          interactive={false}
          style={{ className: 'sector-contorno' }}
        />
      )}
      {sectores.features.map((sector) => (
        <MarcadorSector
          key={sector.properties.id}
          posicion={puntoEtiqueta(sector)}
          nombre={sector.properties.nombre}
          estado={estadoDeSector(estados, sector.properties.id, servicio)}
          propio={sector.properties.id === propio}
          compacto={anchoEnPantalla(mapa, sector) < ANCHO_MINIMO_NOMBRE}
        />
      ))}
    </>
  );
}

/** Por debajo de este ancho (px) el nombre del sector no cabe: solo va la insignia. */
const ANCHO_MINIMO_NOMBRE = 90;

const anchoEnPantalla = (mapa: MapaLeaflet, sector: SectorFeatureDto): number => {
  const limites = geoJSON(sector).getBounds();
  return (
    mapa.latLngToContainerPoint(limites.getNorthEast()).x -
    mapa.latLngToContainerPoint(limites.getSouthWest()).x
  );
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

/** Encuadra todos los sectores al cargarlos y cuando cambia el espacio libre (teléfono ↔ escritorio). */
function Encuadre({ sectores, relleno }: { sectores: SectoresGeoJsonDto; relleno: Relleno }) {
  const mapa = useMap();
  const [izquierda, arriba] = relleno.arribaIzquierda;
  const [derecha, abajo] = relleno.abajoDerecha;
  useEffect(() => {
    mapa.fitBounds(limitesDe(sectores), {
      paddingTopLeft: [izquierda, arriba],
      paddingBottomRight: [derecha, abajo],
    });
  }, [mapa, sectores, izquierda, arriba, derecha, abajo]);
  return null;
}
