import { useEffect, useRef, useState } from 'react';
import { sincronizarSuscripcion } from '../aplicacion/notificaciones';
import { Icono } from '../componentes/ui/Icono';
import { useEstadosSector, usePerfil, useSesion } from '../datos/consultas';
import { usePuertos } from '../datos/contexto';
import { esIdNotificacion } from '../dominio/push';
import type { EstadoSector } from '../dominio/tipos';
import { quitarParametro, useParametro } from '../navegacion/ruta';
import { almacenLocal } from './almacen';
import { textoCambioSector } from './textos';

/** Cuánto se queda el aviso en pantalla si nadie lo cierra. */
const DURACION_AVISO_MS = 15_000;

/**
 * Lo que las notificaciones hacen con la app abierta (T-072): apuntar que se abrió una
 * (`?n=<id>`), mantener la suscripción al día en la API y avisar dentro de la app cuando cambia el
 * estado de tu sector (para quien no recibe push, como un iPhone sin la app instalada).
 */
export function NotificacionesEnLaApp() {
  const usuario = useSesion();
  const perfil = usePerfil();
  useNotificacionAbierta(usuario !== null);
  useSincronizarSuscripcion(perfil.data?.sectorId);
  if (!perfil.data) return null;
  return <AvisoSector sectorId={perfil.data.sectorId} sectorNombre={perfil.data.sectorNombre} />;
}

/**
 * `?n=<id>`: la app se abrió desde una notificación. Se apunta en la API (la tasa de apertura y la
 * pausa de los recordatorios dependen de esto) y se quita de la URL. Sin red o sin sesión se
 * ignora: es una métrica, no puede romper nada.
 */
function useNotificacionAbierta(conSesion: boolean) {
  const { notificaciones } = usePuertos();
  const n = useParametro('n');
  useEffect(() => {
    if (n === null) return;
    if (conSesion && esIdNotificacion(n))
      void notificaciones.marcarAbierta(n).catch(() => undefined);
    quitarParametro('n');
  }, [n, conSesion, notificaciones]);
}

/** Una vez por perfil y por día, la suscripción de este navegador vuelve a la API. */
function useSincronizarSuscripcion(sectorId: number | undefined) {
  const puertos = usePuertos();
  useEffect(() => {
    if (sectorId === undefined) return;
    void sincronizarSuscripcion(puertos, {
      almacen: almacenLocal(),
      ahora: puertos.reloj.ahora(),
    }).catch(() => false);
  }, [sectorId, puertos]);
}

const claveFila = (f: EstadoSector) => `${f.sectorId}/${f.tipoServicio}`;

/** "Se fue la luz en Guaparo…": un aviso breve cuando Realtime trae un cambio confirmado de tu sector. */
function AvisoSector({ sectorId, sectorNombre }: { sectorId: number; sectorNombre: string }) {
  const { estadosSector } = usePuertos();
  const estados = useEstadosSector();
  const conocidos = useRef(new Map<string, EstadoSector>());
  const [aviso, setAviso] = useState<string | null>(null);

  // Lo último que se sabía de cada fila. Se actualiza después de pintar, así que el oyente de
  // abajo todavía ve el estado anterior cuando llega un cambio.
  useEffect(() => {
    for (const fila of estados.data ?? []) conocidos.current.set(claveFila(fila), fila);
  }, [estados.data]);

  useEffect(
    () =>
      estadosSector.suscribir((fila) => {
        if (fila.sectorId !== sectorId) return;
        const texto = textoCambioSector(conocidos.current.get(claveFila(fila)), fila, sectorNombre);
        conocidos.current.set(claveFila(fila), fila);
        if (texto) setAviso(texto);
      }),
    [estadosSector, sectorId, sectorNombre],
  );

  useEffect(() => {
    if (!aviso) return;
    const temporizador = setTimeout(() => setAviso(null), DURACION_AVISO_MS);
    return () => clearTimeout(temporizador);
  }, [aviso]);

  if (!aviso) return null;
  return (
    <div
      role="status"
      className="fixed right-4 bottom-[176px] left-4 z-[1100] flex items-center justify-between gap-3 rounded-bloque bg-inverso-fondo px-4 py-2.5 text-sm text-inverso-texto lg:top-6 lg:bottom-auto lg:left-auto lg:w-[360px]"
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <Icono nombre="bell" tamano={18} />
        <span>{aviso}</span>
      </span>
      <button
        type="button"
        aria-label="Cerrar el aviso"
        onClick={() => setAviso(null)}
        className="grid h-11 w-11 flex-none place-items-center rounded-control"
      >
        <Icono nombre="x" tamano={18} />
      </button>
    </div>
  );
}
