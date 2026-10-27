import { TipoServicio } from '@blackout/shared';
import { useState } from 'react';
import { Boton } from '../componentes/ui/Boton';
import { ChipSync } from '../componentes/ui/Chips';
import { Icono } from '../componentes/ui/Icono';
import { Esqueleto } from '../componentes/ui/Mensaje';
import { useColaAvisos } from '../datos/consultas';
import { usePuertos } from '../datos/contexto';
import { textoAccion } from '../dominio/aviso';
import { mensajeDeError } from '../dominio/errores';
import type { AvisoCola } from '../dominio/tipos';
import { Enlace } from '../navegacion/ruta';
import { diaRelativo, hora } from '../utils/formato';

/**
 * "Tus avisos": la cola tal como está en este dispositivo (PWA.md §7), del más reciente al más
 * antiguo. Un aviso rechazado (400, 409, 422) es un error permanente: se explica con su código y
 * se ofrece "Reintentar" o "Descartar". Vive en su propia pantalla, `/avisos` (D-037).
 */
export function ListaAvisos({ sincronizar }: { sincronizar: () => Promise<void> }) {
  const cola = useColaAvisos();
  const avisos = [...(cola.data ?? [])].reverse();

  return (
    <section id="cola" aria-label="Lista de avisos" className="flex flex-col gap-2">
      {cola.isPending ? (
        <Esqueleto className="h-16" />
      ) : avisos.length === 0 ? (
        <SinAvisos />
      ) : (
        <ul className="rounded-tarjeta border border-borde bg-superficie px-4">
          {avisos.map((aviso) => (
            <FilaAviso key={aviso.id} aviso={aviso} sincronizar={sincronizar} />
          ))}
        </ul>
      )}
    </section>
  );
}

/** Estado vacío: qué va a aparecer aquí y el camino para el primer aviso. */
function SinAvisos() {
  return (
    <div className="flex flex-col items-start gap-3 rounded-tarjeta border border-borde bg-superficie p-4">
      <span className="grid h-10 w-10 place-items-center rounded-control bg-superficie-2 text-texto-2">
        <Icono nombre="clock" tamano={20} />
      </span>
      <div className="flex flex-col gap-1">
        <p className="font-semibold">Aún no tienes avisos</p>
        <p className="text-sm leading-[1.4] text-secundario">
          Cuando reportes que se fue o volvió el servicio, el aviso aparece aquí al instante, aunque
          no haya conexión, y ves si ya llegó.
        </p>
      </div>
      <Enlace
        a="/reportar"
        className="inline-flex h-11 items-center gap-2 rounded-control bg-acento px-4 text-sm font-semibold text-sobre-acento"
      >
        <Icono nombre="plus" tamano={18} grosor={2.4} />
        Reportar un corte
      </Enlace>
    </div>
  );
}

function FilaAviso({ aviso, sincronizar }: { aviso: AvisoCola; sincronizar: () => Promise<void> }) {
  const { colaAvisos, reloj } = usePuertos();
  const [ocupado, setOcupado] = useState(false);

  const reintentar = async () => {
    setOcupado(true);
    try {
      await colaAvisos.reintentar(aviso.id);
      await sincronizar();
    } finally {
      setOcupado(false);
    }
  };

  return (
    <li className="flex flex-col gap-2 border-t border-borde py-3 first:border-t-0">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 flex-none place-items-center rounded-control bg-superficie-2 text-texto-2">
          <Icono
            nombre={aviso.tipoServicio === TipoServicio.Electricidad ? 'zap' : 'droplet'}
            tamano={18}
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{textoAccion(aviso.accion, aviso.tipoServicio)}</p>
          <p className="text-[13px] text-secundario tabular-nums">
            {diaRelativo(aviso.ocurridoEn, reloj.ahora())}, {hora(aviso.ocurridoEn)}
          </p>
        </div>
        <ChipSync estado={aviso.estado} />
      </div>
      {aviso.estado === 'error' && (
        <>
          <p className="text-[13px] leading-[1.35] text-estado-sin-servicio-tinta">
            {mensajeDeError(aviso.codigoError, aviso.tipoServicio)}
          </p>
          <div className="flex flex-wrap gap-2">
            <Boton
              variante="secundario"
              icono="refresh-cw"
              cargando={ocupado}
              onClick={() => void reintentar()}
            >
              Reintentar
            </Boton>
            <Boton
              variante="peligro"
              icono="x"
              disabled={ocupado}
              onClick={() => void colaAvisos.quitar(aviso.id)}
            >
              Descartar
            </Boton>
          </div>
        </>
      )}
    </li>
  );
}
