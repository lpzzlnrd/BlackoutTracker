import type { SectorFeatureDto, SectoresGeoJsonDto, TipoServicio, ZonaDto } from '@blackout/shared';
import {
  divIcon,
  geoJSON,
  point,
  type Layer,
  type Map as MapaLeaflet,
  type PathOptions,
} from 'leaflet';
import { useEffect, useMemo, useRef, useState } from 'react';
import { GeoJSON, Marker, Pane, useMap, useMapEvents } from 'react-leaflet';
import type { EstadoSector } from '../dominio/tipos';
import { contiene, puntoEtiqueta } from './geometria';
import { useEsEscritorio } from './HojaSector';
import { limitesDe, Mascara } from './MapaBase';
import { ALTO_NOMBRE, anchoNombre, marcadorSector, TAMANO_NOMBRE } from './marcador';
import { estadoDeSector } from './textos';

/** Espacio que tapan las superposiciones, como puntos de Leaflet: `[x, y]` en píxeles. */
export interface Relleno {
  arribaIzquierda: [number, number];
  abajoDerecha: [number, number];
}

/**
 * La coropleta (CANON §4): fuera de la Gran Valencia, la máscara; un hexágono por sector con la
 * clase de su estado; el contorno grueso del sector elegido y, encima, etiqueta + insignia de cada
 * uno. Vive dentro del `MapContainer`.
 */
export function CapaSectores({
  sectores,
  zona,
  estados,
  servicio,
  seleccionado,
  propio,
  relleno,
  onSeleccionar,
}: {
  sectores: SectoresGeoJsonDto;
  /** El contorno de la Gran Valencia; mientras no llega, no hay máscara. */
  zona: ZonaDto | undefined;
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
      {zona && <Mascara zona={zona} />}
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
        // Un hexágono de menos de ~32 px en pantalla (la ciudad entera en un teléfono) va solo con
        // relleno y trazo: la insignia taparía a los vecinos (D-040).
        if (anchoEnPantalla(mapa, sector) < ANCHO_MINIMO_MARCADOR) return null;
        const nombre = sector.properties.nombre;
        const esPropio = sector.properties.id === propio;
        const posicion = puntoEtiqueta(sector);
        return (
          <MarcadorSector
            key={sector.properties.id}
            posicion={posicion}
            nombre={nombre}
            estado={estadoDeSector(estados, sector.properties.id, servicio)}
            propio={esPropio}
            compacto={!cabeEn(mapa, sector, posicion, anchoNombre(nombre, tamanoNombre))}
          />
        );
      })}
    </>
  );
}

/** Por debajo de este ancho en pantalla (px), un sector no lleva nombre ni insignia. */
const ANCHO_MINIMO_MARCADOR = 32;

/** Ancho del sector en pantalla, en píxeles, al zoom actual. */
const anchoEnPantalla = (mapa: MapaLeaflet, sector: SectorFeatureDto): number => {
  const caja = geoJSON(sector).getBounds();
  return (
    mapa.latLngToContainerPoint(caja.getNorthEast()).x -
    mapa.latLngToContainerPoint(caja.getSouthWest()).x
  );
};

/**
 * Si el nombre cabe dentro del sector tal como se ve ahora: las cuatro esquinas de su fila tienen
 * que caer en el polígono (la insignia, pequeña y centrada debajo, no cuenta). El rectángulo que
 * envuelve al sector no sirve: en uno inclinado o angosto es mucho más ancho que el sector.
 */
const cabeEn = (
  mapa: MapaLeaflet,
  sector: SectorFeatureDto,
  posicion: [number, number],
  ancho: number,
): boolean => {
  const ancla = mapa.latLngToContainerPoint(posicion);
  return [-1, 1].every((dx) =>
    [-1, 1].every((dy) => {
      const esquina = mapa.containerPointToLatLng([
        ancla.x + (dx * ancho) / 2,
        ancla.y + (dy * ALTO_NOMBRE) / 2,
      ]);
      return contiene(sector, esquina.lat, esquina.lng);
    }),
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

/**
 * Encuadra la Gran Valencia (el casco urbano y los sectores) dejando libre lo que tapan las
 * superposiciones. Tampoco deja alejarse más de un nivel de ese encuadre ni irse lejos.
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
