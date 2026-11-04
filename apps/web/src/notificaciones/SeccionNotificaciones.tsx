import type { PreferenciasNotificacionesDto } from '@blackout/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { Boton } from '../componentes/ui/Boton';
import { Esqueleto, Mensaje } from '../componentes/ui/Mensaje';
import {
  claves,
  useClavePush,
  usePreferenciasNotificaciones,
  useSesion,
  useSuscripcionPush,
} from '../datos/consultas';
import { usePuertos } from '../datos/contexto';
import { TEXTO_SILENCIO, textoEstadoPush, textoResultadoActivar } from './textos';
import { useActivarNotificaciones } from './useActivarNotificaciones';

/**
 * Cuenta → Notificaciones (T-072, D-042): activarlas en este dispositivo y elegir los
 * recordatorios y el agua de noche. Solo para vecinos con su vivienda marcada: los avisos son de
 * su sector.
 */
export function SeccionNotificaciones() {
  const { push } = usePuertos();
  const clave = useClavePush();
  const suscripcion = useSuscripcionPush();
  const { activar, desactivar, ocupado, resultado, error } = useActivarNotificaciones();
  const estado = push.estado();
  const suscrita = Boolean(suscripcion.data);
  const explicacion = textoEstadoPush(estado, clave.data?.activo ?? false);

  return (
    <section
      aria-labelledby="titulo-notificaciones"
      className="flex flex-col gap-3 rounded-tarjeta border border-borde bg-superficie p-4 lg:p-6"
    >
      <h2 id="titulo-notificaciones" className="text-lg leading-tight font-bold">
        Notificaciones
      </h2>
      <p className="text-sm text-secundario">
        Te avisamos cuando tus vecinos confirman que se fue o volvió el servicio en tu sector.
      </p>

      {clave.isPending || suscripcion.isPending ? (
        <Esqueleto className="h-11 w-48" />
      ) : suscrita && estado === 'concedido' ? (
        <>
          <p className="text-sm font-semibold">Activadas en este dispositivo.</p>
          <Preferencias />
          <Boton
            variante="secundario"
            icono="bell-off"
            className="self-start"
            cargando={ocupado}
            onClick={() => void desactivar()}
          >
            Desactivar en este dispositivo
          </Boton>
        </>
      ) : explicacion ? (
        <Mensaje tono={estado === 'denegado' ? 'aviso' : 'info'}>{explicacion}</Mensaje>
      ) : (
        <Boton
          icono="bell"
          className="self-start"
          cargando={ocupado}
          onClick={() => void activar()}
        >
          Activar en este dispositivo
        </Boton>
      )}

      {resultado && resultado !== 'activadas' && (
        <Mensaje tono="aviso">{textoResultadoActivar(resultado)}</Mensaje>
      )}
      {error && (
        <Mensaje tono="error">
          No se pudo completar. Revisa tu conexión e inténtalo de nuevo.
        </Mensaje>
      )}
      <p className="text-[13px] leading-[1.4] text-secundario">{TEXTO_SILENCIO}</p>
    </section>
  );
}

/** Los dos interruptores. Cada cambio se guarda al momento (`PATCH /notificaciones/preferencias`). */
function Preferencias() {
  const { notificaciones } = usePuertos();
  const usuario = useSesion();
  const cliente = useQueryClient();
  const preferencias = usePreferenciasNotificaciones(true);
  const [guardando, setGuardando] = useState<keyof PreferenciasNotificacionesDto | null>(null);
  const [error, setError] = useState(false);

  async function cambiar(campo: keyof PreferenciasNotificacionesDto, valor: boolean) {
    setGuardando(campo);
    setError(false);
    try {
      const nuevas = await notificaciones.cambiarPreferencias({ [campo]: valor });
      cliente.setQueryData(claves.preferenciasNotificaciones(usuario?.id), nuevas);
    } catch {
      setError(true);
    } finally {
      setGuardando(null);
    }
  }

  if (preferencias.isPending) return <Esqueleto className="h-24" />;
  if (preferencias.isError || !preferencias.data) {
    return <p className="text-sm text-secundario">No se pudieron cargar tus preferencias.</p>;
  }
  const { recordatorios, aguaDeNoche } = preferencias.data;
  return (
    <div className="flex flex-col gap-1 border-t border-borde pt-3">
      <Interruptor
        etiqueta="Recordatorios"
        ayuda="Como mucho uno al día, y solo si pasó algo en tu sector y no has entrado."
        activo={recordatorios}
        deshabilitado={guardando !== null}
        onChange={(v) => void cambiar('recordatorios', v)}
      />
      <Interruptor
        etiqueta="Avísame aunque sea de noche cuando llegue el agua"
        ayuda="Para que te dé tiempo de llenar los tobos."
        activo={aguaDeNoche}
        deshabilitado={guardando !== null}
        onChange={(v) => void cambiar('aguaDeNoche', v)}
      />
      {error && <Mensaje tono="error">No se guardó el cambio. Revisa tu conexión.</Mensaje>}
    </div>
  );
}

/** Interruptor accesible (`role="switch"`): toda la fila se puede tocar y mide 44 px o más. */
function Interruptor({
  etiqueta,
  ayuda,
  activo,
  deshabilitado,
  onChange,
}: {
  etiqueta: string;
  ayuda: string;
  activo: boolean;
  deshabilitado: boolean;
  onChange: (valor: boolean) => void;
}) {
  const idAyuda = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-describedby={idAyuda}
      disabled={deshabilitado}
      onClick={() => onChange(!activo)}
      className="flex min-h-11 items-center justify-between gap-3 py-2 text-left disabled:opacity-55"
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-semibold">{etiqueta}</span>
        <span id={idAyuda} className="text-[13px] leading-[1.35] text-secundario">
          {ayuda}
        </span>
      </span>
      <span
        aria-hidden="true"
        className={`relative h-7 w-12 flex-none rounded-chip transition-colors motion-reduce:transition-none ${
          activo ? 'bg-acento' : 'bg-superficie-2 ring-1 ring-borde-control'
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-chip bg-superficie transition-[left] motion-reduce:transition-none ${
            activo ? 'left-6' : 'left-1'
          }`}
        />
      </span>
    </button>
  );
}
