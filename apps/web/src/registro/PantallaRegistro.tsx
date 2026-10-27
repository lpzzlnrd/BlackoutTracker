import { CodigoError, type PinDto, type SectorAsignadoDto } from '@blackout/shared';
import { useQueryClient } from '@tanstack/react-query';
import { divIcon, type Map as MapaLeaflet } from 'leaflet';
import { useEffect, useState } from 'react';
import { GeoJSON, Marker, useMap, useMapEvents } from 'react-leaflet';
import { Contenido, EncabezadoPantalla } from '../componentes/marco/Marco';
import { Boton } from '../componentes/ui/Boton';
import { Icono } from '../componentes/ui/Icono';
import { Esqueleto, Mensaje } from '../componentes/ui/Mensaje';
import { claves, useSectores, useSesion } from '../datos/consultas';
import { usePuertos } from '../datos/contexto';
import { ErrorApiCliente, mensajeDeError } from '../dominio/errores';
import { sectorDelPin } from '../dominio/sector-del-pin';
import { AtribucionOSM, MapaBase, limitesDe } from '../mapa/MapaBase';

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

/** Mensaje de un fallo de la API al validar o crear el perfil. */
const mensajeRegistro = (error: unknown): string =>
  error instanceof ErrorApiCliente && error.esDeRed
    ? 'Necesitas conexión para registrar tu vivienda. Inténtalo cuando vuelva la red.'
    : mensajeDeError(error instanceof ErrorApiCliente ? error.codigo : undefined);

/**
 * Registro en dos pasos (REG, D-014): el pin sobre la vivienda, una sola vez y a mano (sin pedir
 * la ubicación del teléfono, REG-06), y la confirmación del sector que dice el servidor. El pin
 * solo viaja a la API; al terminar se olvida (NF-06).
 */
export function PantallaRegistro() {
  const { residente } = usePuertos();
  const usuario = useSesion();
  const sectores = useSectores();
  const cliente = useQueryClient();
  const [mapa, setMapa] = useState<MapaLeaflet | null>(null);

  const [pin, setPin] = useState<PinDto | null>(null);
  const [asignado, setAsignado] = useState<SectorAsignadoDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const confirmando = asignado !== null;
  const local = pin && sectores.data ? sectorDelPin(sectores.data, pin) : null;
  const sectorLocal = local
    ? sectores.data?.features.find((f) => f.properties.id === local.id)
    : undefined;

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
            : 'Paso 1 de 2 · Toca el mapa justo sobre tu casa. Se hace una sola vez.'
        }
      />

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:items-start lg:gap-6">
        <div className="relative h-[52dvh] min-h-[300px] overflow-hidden rounded-tarjeta border border-borde lg:order-2 lg:h-[560px]">
          {sectores.isPending ? (
            <Esqueleto className="h-full rounded-none" />
          ) : (
            <MapaBase
              limites={limitesDe(sectores.data)}
              etiqueta="Mapa de Guaparo para marcar tu vivienda"
            >
              {sectores.data && (
                <GeoJSON
                  data={sectores.data}
                  interactive={false}
                  style={() => ({ className: 'sector sector--neutro' })}
                />
              )}
              {sectorLocal && (
                <GeoJSON
                  key={sectorLocal.properties.id}
                  data={sectorLocal}
                  interactive={false}
                  style={() => ({ className: 'sector-contorno' })}
                />
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
          )}
          <AtribucionOSM className="absolute right-2 bottom-2" />
        </div>

        <section aria-label="Tu vivienda" className="flex flex-col gap-4 lg:order-1">
          {sectores.isError && (
            <Mensaje tono="error">
              No se pudo cargar el mapa de Guaparo.{' '}
              <button type="button" className="underline" onClick={() => void sectores.refetch()}>
                Reintentar
              </button>
            </Mensaje>
          )}

          {confirmando ? (
            <div className="flex flex-col gap-4 rounded-tarjeta border border-borde bg-superficie p-4">
              <div>
                <p className="text-xs text-secundario">Tu sector</p>
                <p className="text-2xl leading-tight font-bold">{asignado.sectorNombre}</p>
              </div>
              <p className="text-sm text-secundario">{PRIVACIDAD}</p>
              <Boton ancho cargando={ocupado} onClick={() => void confirmar()}>
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
                <Mensaje>Toca el mapa sobre tu vivienda para poner el pin.</Mensaje>
              ) : local ? (
                <p role="status" className="flex items-center gap-2 text-[15px]">
                  <Icono nombre="check-circle" tamano={20} className="text-acento" />
                  <span>
                    El pin cae en <strong>{local.nombre}</strong>.
                  </span>
                </p>
              ) : (
                <Mensaje tono="error">{mensajeDeError(CodigoError.PinFueraDeGuaparo)}</Mensaje>
              )}
              <Boton ancho disabled={!local} cargando={ocupado} onClick={() => void continuar()}>
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
