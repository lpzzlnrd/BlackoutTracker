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
import { diaRelativo, hora } from '../utils/formato';

/**
 * "Tus avisos": la cola tal como está en este dispositivo (PWA.md §7), del más reciente al más
 * antiguo. Un aviso rechazado (400, 409, 422) es un error permanente: se explica con su código y
 * se ofrece "Reintentar" o "Descartar".
 */
export function ListaAvisos({ sincronizar }: { sincronizar: () => Promise<void> }) {
  const cola = useColaAvisos();
  const avisos = [...(cola.data ?? [])].reverse();

  return (
    <section id="cola" aria-labelledby="titulo-cola" className="flex flex-col gap-2">
      <h2 id="titulo-cola" className="text-base font-bold">
        Tus avisos
      </h2>
      {cola.isPending ? (
        <Esqueleto className="h-16" />
      ) : avisos.length === 0 ? (
        <p className="rounded-bloque border border-borde bg-superficie px-4 py-3 text-sm text-secundario">
          Aún no tienes avisos. Lo que reportes aparece aquí al instante, aunque no haya conexión.
        </p>
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
