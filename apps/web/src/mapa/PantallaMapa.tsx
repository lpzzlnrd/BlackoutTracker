import './pantalla-mapa.css';
import { TipoServicio, type SectoresGeoJsonDto } from '@blackout/shared';
import { geoJSON, type Map as MapaLeaflet } from 'leaflet';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { Boton } from '../componentes/ui/Boton';
import { EstadoChip } from '../componentes/ui/Chips';
import { Icono } from '../componentes/ui/Icono';
import { Esqueleto, Mensaje } from '../componentes/ui/Mensaje';
import { SelectorServicio } from '../componentes/ui/SelectorServicio';
import { useEstadosSector, usePerfil, useSectores } from '../datos/consultas';
import { useServicio } from '../datos/preferencias';
import type { EstadoSector, EstadoVisual } from '../dominio/tipos';
import { Enlace } from '../navegacion/ruta';
import { CapaSectores, encuadrar, type Relleno } from './CapaSectores';
import { DetalleSector } from './DetalleSector';
import { alturaAsomada, HojaSector, useEsEscritorio, type PosicionHoja } from './HojaSector';
import { AtribucionOSM, DefinicionesMapa, limitesDe, MapaBase } from './MapaBase';
import { anunciosDeCambio, estadoDeSector, etiquetaMapa } from './textos';

/**
 * La leyenda: tres estados, de más a menos grave, como el panel (D-038; CANON §4.5 los ponía al
 * revés). "Sin datos" no va.
 */
const LEYENDA: readonly EstadoVisual[] = ['sin-servicio', 'sin-confirmar', 'con-servicio'];

/** Cuántos sectores están sin un servicio: la insignia del selector (D-038). */
const sinServicio = (
  sectores: readonly { id: number }[],
  estados: EstadoSector[] | undefined,
  servicio: TipoServicio,
): number =>
  sectores.filter((s) => estadoDeSector(estados, s.id, servicio) === 'sin-servicio').length;

// Lo que tapan las superposiciones, para que el encuadre deje los sectores a la vista (A §3). En
// el teléfono, arriba el selector y la leyenda (la barra de la marca ya no está sobre el mapa,
// D-038); abajo, la hoja asomada más la atribución que flota sobre ella.
const rellenoTelefono = (hoja: number): Relleno => ({
  arribaIzquierda: [24, 108],
  abajoDerecha: [24, hoja + 30],
});
const RELLENO_ESCRITORIO: Relleno = { arribaIzquierda: [32, 88], abajoDerecha: [32, 100] };

/**
 * Mapa primero (propuesta A, VIS-01): la coropleta llena la pantalla y el estado del sector vive
 * en una hoja inferior (teléfono) o en un panel lateral (escritorio). Mirar no pide cuenta (D-029).
 */
export function PantallaMapa() {
  const [servicio, elegirServicio] = useServicio();
  const sectores = useSectores();
  const estados = useEstadosSector();
  const perfil = usePerfil();
  const escritorio = useEsEscritorio();
  const [elegido, setElegido] = useState<number | null>(null);
  const [posicion, setPosicion] = useState<PosicionHoja>('asomada');
  const contenedor = useRef<HTMLDivElement>(null);
  const hoja = alturaAsomada(useAlto(contenedor));
  const relleno = escritorio ? RELLENO_ESCRITORIO : rellenoTelefono(hoja);
  const [mapa, setMapa] = useState<MapaLeaflet | null>(null);
  const geometria = sectores.data;
  // En el teléfono, con la hoja abierta el botón quedaría debajo de ella.
  const verTodo = useFueraDeEncuadre(mapa, geometria) && (escritorio || posicion === 'asomada');

  const lista = sectores.data?.features ?? [];
  const nombres = lista.map((f) => f.properties);
  const cortes = {
    [TipoServicio.Electricidad]: sinServicio(nombres, estados.data, TipoServicio.Electricidad),
    [TipoServicio.Agua]: sinServicio(nombres, estados.data, TipoServicio.Agua),
  };
  const propio = perfil.data?.sectorId;
  // Por defecto, el sector del vecino; sin cuenta, el primero (A §5).
  const seleccionado = elegido ?? propio ?? nombres[0]?.id;
  const sector = nombres.find((s) => s.id === seleccionado);
  const anuncio = useAnuncio(estados.data, (id) => nombres.find((s) => s.id === id)?.nombre);

  // Tocar el sector propio vuelve a la vista por defecto.
  const seleccionar = (id: number) => setElegido(id === propio ? null : id);

  const detalle = sector ? (
    <DetalleSector
      key={sector.id}
      sectorId={sector.id}
      nombre={sector.nombre}
      servicio={servicio}
      propio={sector.id === propio}
      variante={escritorio ? 'panel' : 'hoja'}
      completo={escritorio || posicion !== 'asomada'}
    />
  ) : sectores.isError ? (
    <div className="flex flex-col gap-3">
      <Mensaje tono="error">No se pudieron cargar los sectores. Revisa tu conexión.</Mensaje>
      <Boton variante="secundario" icono="refresh-cw" onClick={() => void sectores.refetch()}>
        Reintentar
      </Boton>
    </div>
  ) : (
    <div className="flex flex-col gap-3">
      <Esqueleto className="h-7 w-40" />
      <Esqueleto className="h-5 w-56" />
      <Esqueleto className="h-12 w-48" />
    </div>
  );

  return (
    <div className="absolute inset-0 flex">
      <DefinicionesMapa />
      <h1 className="sr-only">Mapa de sectores</h1>
      {/* El mapa nunca es la única vía (CANON §4.6): la lista está en el Panel. */}
      <Enlace
        a="/panel"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[1100] focus:rounded-control focus:bg-superficie focus:px-3 focus:py-2.5 focus:font-semibold"
      >
        Ver los sectores en una lista
      </Enlace>

      <div ref={contenedor} className="relative min-w-0 flex-1">
        <MapaBase
          limites={limitesDe(sectores.data)}
          relleno={relleno}
          etiqueta={etiquetaMapa(nombres, estados.data, servicio)}
          refMapa={setMapa}
        >
          {sectores.data && (
            <CapaSectores
              sectores={sectores.data}
              estados={estados.data}
              servicio={servicio}
              seleccionado={seleccionado}
              propio={propio}
              relleno={relleno}
              onSeleccionar={seleccionar}
            />
          )}
        </MapaBase>

        {verTodo && mapa && geometria && (
          <button
            type="button"
            onClick={() => encuadrar(mapa, geometria, relleno)}
            className="absolute left-4 z-[1000] flex h-11 items-center gap-2 rounded-chip border border-borde bg-superficie pr-3.5 pl-3 text-sm font-semibold lg:top-4 lg:right-4 lg:left-auto"
            style={escritorio ? undefined : { bottom: hoja + 8 }}
          >
            <Icono nombre="map" tamano={18} />
            Ver todo Guaparo
          </button>
        )}

        {/* La marca y los pendientes viven en la barra superior del marco; el selector va a todo
            el ancho y dice cuántos sectores están sin cada servicio (D-038). */}
        <div className="absolute inset-x-4 top-2 z-[1000] lg:inset-x-auto lg:top-4 lg:left-4">
          <SelectorServicio
            valor={servicio}
            onChange={elegirServicio}
            ancho={escritorio ? 112 : 'completo'}
            cortes={cortes}
          />
        </div>

        {/* Leyenda: chips en fila en el teléfono, tarjeta en el escritorio (A §3 y §4). */}
        <ul
          aria-label="Leyenda"
          className="absolute inset-x-4 top-[70px] z-[1000] flex flex-wrap gap-1.5 lg:hidden"
        >
          {LEYENDA.map((estado) => (
            <li key={estado}>
              <EstadoChip estado={estado} variante="compacto" />
            </li>
          ))}
        </ul>
        <div className="absolute bottom-4 left-4 z-[1000] hidden flex-col gap-2 rounded-bloque border border-borde bg-superficie p-3 lg:flex">
          <p className="text-xs font-bold tracking-[.05em] text-secundario uppercase">Leyenda</p>
          <ul className="flex flex-col items-start gap-2">
            {LEYENDA.map((estado) => (
              <li key={estado}>
                <EstadoChip estado={estado} variante="compacto" texto="largo" />
              </li>
            ))}
          </ul>
        </div>

        {escritorio ? (
          <AtribucionOSM className="absolute right-2 bottom-2" />
        ) : (
          <HojaSector posicion={posicion} asomada={hoja} onCambiar={setPosicion}>
            {detalle}
          </HojaSector>
        )}
      </div>

      {escritorio && (
        <aside className="flex w-[340px] flex-none flex-col overflow-y-auto border-l border-borde bg-superficie p-6">
          {detalle}
        </aside>
      )}

      {/* Los cambios que llegan por Realtime se anuncian, una frase por cambio (CANON §4.6). */}
      <p aria-live="polite" className="sr-only">
        {anuncio}
      </p>
    </div>
  );
}

/**
 * Compara cada lectura de `estado_sector` con la anterior y deja la frase de lo que cambió. Se
 * calcula durante el render (estado derivado), sin efectos.
 */
function useAnuncio(
  estados: EstadoSector[] | undefined,
  nombre: (sectorId: number) => string | undefined,
): string {
  const [previos, setPrevios] = useState(estados);
  const [anuncio, setAnuncio] = useState('');
  if (estados !== previos) {
    const frases = anunciosDeCambio(previos, estados, (id) => nombre(id) ?? `Sector ${id}`);
    setPrevios(estados);
    if (frases.length > 0) setAnuncio(frases.join('. '));
  }
  return anuncio;
}

/**
 * Si la vista ya no muestra todos los sectores (el vecino acercó el mapa o lo movió): entonces se
 * ofrece volver al encuadre. Al cargar está encuadrado, así que basta con mirar al terminar cada
 * movimiento.
 */
function useFueraDeEncuadre(
  mapa: MapaLeaflet | null,
  sectores: SectoresGeoJsonDto | undefined,
): boolean {
  const [fuera, setFuera] = useState(false);
  useEffect(() => {
    if (!mapa || !sectores?.features.length) return;
    const limites = geoJSON(sectores).getBounds();
    const revisar = () => setFuera(!mapa.getBounds().contains(limites));
    mapa.on('moveend', revisar);
    return () => {
      mapa.off('moveend', revisar);
    };
  }, [mapa, sectores]);
  return fuera;
}

/** Alto en píxeles de un elemento, al día con cada cambio de tamaño (girar el teléfono). */
function useAlto(ref: RefObject<HTMLElement | null>): number {
  const [alto, setAlto] = useState(() => window.innerHeight);
  useEffect(() => {
    const elemento = ref.current;
    if (!elemento) return;
    const observador = new ResizeObserver(([entrada]) => {
      if (entrada) setAlto(entrada.contentRect.height);
    });
    observador.observe(elemento);
    return () => observador.disconnect();
  }, [ref]);
  return alto;
}
