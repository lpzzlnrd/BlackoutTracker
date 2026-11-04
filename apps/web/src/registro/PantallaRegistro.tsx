import { CodigoError, type PinDto, type PinValidadoDto } from '@blackout/shared';
import { useQueryClient } from '@tanstack/react-query';
import { divIcon, geoJSON, type Map as MapaLeaflet } from 'leaflet';
import { useEffect, useState } from 'react';
import { GeoJSON, Marker, useMap, useMapEvents } from 'react-leaflet';
import { Contenido, EncabezadoPantalla } from '../componentes/marco/Marco';
import { Boton } from '../componentes/ui/Boton';
import { Icono } from '../componentes/ui/Icono';
import { Mensaje } from '../componentes/ui/Mensaje';
import { claves, useSectores, useSesion, useZona } from '../datos/consultas';
import { usePuertos } from '../datos/contexto';
import { dentroDeZona } from '../dominio/dentro-de-zona';
import { ErrorApiCliente, mensajeDeError } from '../dominio/errores';
import { AtribucionOSM, limitesDe, MapaBase, Mascara } from '../mapa/MapaBase';

// El pin, en el acento y con borde del color de la superficie: se lee sobre cualquier tesela.
const ICONO_PIN = divIcon({
  className: 'icono-mapa',
  iconSize: [34, 34],
  iconAnchor: [17, 33],
  html: `<svg width="34" height="34" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.2c-3.9 0-7 3-7 6.9 0 5.2 7 12.7 7 12.7s7-7.5 7-12.7c0-3.9-3.1-6.9-7-6.9z" fill="var(--acento)" stroke="var(--superficie)" stroke-width="1.4"/><circle cx="12" cy="9.2" r="2.6" fill="var(--superficie)"/></svg>`,
});

const PRIVACIDAD =
  'Nadie ve tu ubicación exacta y no se guarda en este teléfono: solo sirve para saber en qué sector estás.';

/** Toques sobre el mapa y acceso a la instancia (para "Poner el pin en el centro"). */
function ControlPin({
  activo,
  alTocar,
  alListo,
}: {
  activo: boolean;
  alTocar: (pin: PinDto) => void;
  alListo: (mapa: MapaLeaflet) => void;
}) {
  const mapa = useMap();
  useEffect(() => alListo(mapa), [mapa, alListo]);
  useMapEvents({
    click: (evento) => {
      if (activo) alTocar({ lat: evento.latlng.lat, lng: evento.latlng.lng });
    },
  });
  return null;
}

/** Al confirmar, acerca el mapa al hexágono que le tocó al vecino. */
function EncuadreSector({ sector }: { sector: PinValidadoDto }) {
  const mapa = useMap();
  useEffect(() => {
    mapa.fitBounds(geoJSON(sector.geometria).getBounds(), { padding: [32, 32], maxZoom: 15 });
  }, [mapa, sector]);
  return null;
}

/** Mensaje de un fallo de la API al validar o crear el perfil. */
const mensajeRegistro = (error: unknown): string =>
  error instanceof ErrorApiCliente && error.esDeRed
    ? 'Necesitas conexión para registrar tu vivienda. Inténtalo cuando vuelva la red.'
    : mensajeDeError(error instanceof ErrorApiCliente ? error.codigo : undefined);

/**
 * Registro en dos pasos (REG, D-014): el pin sobre la vivienda, una sola vez y a mano (sin pedir
 * la ubicación del teléfono, REG-06), y la confirmación del sector que dice el servidor: el
 * hexágono H3 de la Gran Valencia en el que cae el pin (D-040). El pin solo viaja a la API; al
 * terminar se olvida (NF-06).
 */
export function PantallaRegistro() {
  const { residente } = usePuertos();
  const usuario = useSesion();
  const sectores = useSectores();
  const zona = useZona();
  const cliente = useQueryClient();
  const [mapa, setMapa] = useState<MapaLeaflet | null>(null);

  const [pin, setPin] = useState<PinDto | null>(null);
  const [asignado, setAsignado] = useState<PinValidadoDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const confirmando = asignado !== null;
  // Sin el contorno (no llegó todavía o no hay red) no hay aviso inmediato: decide el servidor.
  const enZona = pin && zona.data ? dentroDeZona(zona.data, pin) : null;

  const colocar = (nuevo: PinDto) => {
    setPin(nuevo);
    setError(null);
  };

  const ponerEnElCentro = () => {
    const centro = mapa?.getCenter();
    if (centro) colocar({ lat: centro.lat, lng: centro.lng });
  };

  async function continuar() {
    if (!pin) return;
    setOcupado(true);
    setError(null);
    try {
      setAsignado(await residente.validarPin(pin));
    } catch (e) {
      setError(mensajeRegistro(e));
    } finally {
      setOcupado(false);
    }
  }

  async function confirmar() {
    if (!pin) return;
    setOcupado(true);
    setError(null);
    try {
      await residente.crear(pin);
      setPin(null);
      // El sector pudo nacer con este registro (D-040): el mapa lo tiene que traer.
      await cliente.invalidateQueries({ queryKey: claves.sectores });
      await cliente.invalidateQueries({ queryKey: claves.perfil(usuario?.id) });
    } catch (e) {
      if (e instanceof ErrorApiCliente && e.codigo === CodigoError.ResidenteYaRegistrado) {
        // Ya tenía perfil (otro dispositivo): se relee y la pantalla pedida aparece sola.
        await cliente.invalidateQueries({ queryKey: claves.perfil(usuario?.id) });
        return;
      }
      setError(mensajeRegistro(e));
      setOcupado(false);
    }
  }

  return (
    <Contenido ancho="amplio">
      <EncabezadoPantalla
        titulo="Marca tu vivienda"
        descripcion={
          confirmando
            ? 'Paso 2 de 2 · Confirma tu sector.'
            : 'Paso 1 de 2 · Acerca el mapa hasta tu calle y toca justo sobre tu casa. Se hace una sola vez.'
        }
      />

      <div
        data-guia="registro-vivienda"
        className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:items-start lg:gap-6"
      >
        <div
          data-guia="mapa-vivienda"
          className="relative h-[52dvh] min-h-[300px] overflow-hidden rounded-tarjeta border border-borde lg:order-2 lg:h-[560px]"
        >
          <MapaBase
            limites={limitesDe(sectores.data)}
            etiqueta="Mapa de la Gran Valencia para marcar tu vivienda"
          >
            {zona.data && <Mascara zona={zona.data} />}
            {sectores.data && (
              <GeoJSON
                key={sectores.data.features.length}
                data={sectores.data}
                interactive={false}
                style={() => ({ className: 'sector sector--neutro' })}
              />
            )}
            {asignado && (
              <>
                <GeoJSON
                  key={JSON.stringify(asignado.geometria.coordinates[0]?.[0]?.[0])}
                  data={asignado.geometria}
                  interactive={false}
                  style={() => ({ className: 'sector-contorno' })}
                />
                <EncuadreSector sector={asignado} />
              </>
            )}
            {pin && (
              <Marker
                position={[pin.lat, pin.lng]}
                icon={ICONO_PIN}
                interactive={false}
                keyboard={false}
              />
            )}
            <ControlPin activo={!confirmando && !ocupado} alTocar={colocar} alListo={setMapa} />
          </MapaBase>
          <AtribucionOSM className="absolute right-2 bottom-2" />
        </div>

        <section aria-label="Tu vivienda" className="flex flex-col gap-4 lg:order-1">
          {zona.isError && (
            <Mensaje tono="error">
              No se pudo cargar el mapa de la Gran Valencia.{' '}
              <button type="button" className="underline" onClick={() => void zona.refetch()}>
                Reintentar
              </button>
            </Mensaje>
          )}

          {confirmando ? (
            <div className="flex flex-col gap-4 rounded-tarjeta border border-borde bg-superficie p-4">
              <div>
                <p className="text-xs text-secundario">Tu sector</p>
                <p className="text-2xl leading-tight font-bold">{asignado.sectorNombre}</p>
                <p className="text-sm text-secundario">Municipio {asignado.municipio}</p>
              </div>
              <p className="text-sm">
                {asignado.sectorId === null &&
                  'Serás el primer vecino registrado en este sector: aparece en el mapa al confirmar. '}
                Tu sector es el hexágono marcado, de unos 0,7 km²: todos los vecinos que viven
                dentro comparten su estado.
              </p>
              <p className="text-sm text-secundario">{PRIVACIDAD}</p>
              <Boton
                ancho
                cargando={ocupado}
                onClick={() => void confirmar()}
                data-guia="confirmar-vivienda"
              >
                Confirmar mi vivienda
              </Boton>
              <Boton
                variante="secundario"
                ancho
                disabled={ocupado}
                onClick={() => {
                  setAsignado(null);
                  setError(null);
                }}
              >
                Cambiar el pin
              </Boton>
            </div>
          ) : (
            <div className="flex flex-col gap-4 rounded-tarjeta border border-borde bg-superficie p-4">
              {!pin ? (
                <Mensaje>
                  Acerca el mapa hasta tu calle y toca sobre tu vivienda para poner el pin.
                </Mensaje>
              ) : enZona === false ? (
                <Mensaje tono="error">{mensajeDeError(CodigoError.PinFueraDeZona)}</Mensaje>
              ) : (
                <p role="status" className="flex items-center gap-2 text-[15px]">
                  <Icono nombre="check-circle" tamano={20} className="text-acento" />
                  <span>
                    El pin está en la <strong>Gran Valencia</strong>. Continúa para ver tu sector.
                  </span>
                </p>
              )}
              <Boton
                ancho
                data-guia="continuar-pin"
                disabled={!pin || enZona === false}
                cargando={ocupado}
                onClick={() => void continuar()}
              >
                Continuar
              </Boton>
              <Boton
                variante="secundario"
                ancho
                disabled={!mapa || ocupado}
                onClick={ponerEnElCentro}
              >
                Poner el pin en el centro del mapa
              </Boton>
              <p className="text-[13px] text-secundario">
                Con teclado: enfoca el mapa, muévelo con las flechas y pon el pin en el centro.{' '}
                {PRIVACIDAD}
              </p>
            </div>
          )}

          {error && <Mensaje tono="error">{error}</Mensaje>}
        </section>
      </div>
    </Contenido>
  );
}
