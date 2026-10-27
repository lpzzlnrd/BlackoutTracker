import {
  CONSENSO_N_POR_DEFECTO,
  ESTIMACION_N_MIN_POR_DEFECTO,
  type EventoSectorDto,
  type TipoServicio,
} from '@blackout/shared';
import { useId } from 'react';
import { BloqueEstimacion } from '../componentes/ui/BloqueEstimacion';
import { Boton } from '../componentes/ui/Boton';
import { Icono } from '../componentes/ui/Icono';
import { Esqueleto } from '../componentes/ui/Mensaje';
import {
  useColaAvisos,
  useConfiguracion,
  useEstadosSector,
  usePerfil,
  useResumen,
} from '../datos/consultas';
import { usePuertos } from '../datos/contexto';
import { estadoVisual } from '../dominio/estado-visual';
import { Enlace, navegar } from '../navegacion/ruta';
import { diaRelativo, duracion } from '../utils/formato';
import { BloqueEstado } from './BloqueEstado';
import {
  duracionDe,
  intervaloCorte,
  minutosDesde,
  textoAvisoPendiente,
  textoBotonPrincipal,
} from './textos';

/**
 * Estado del sector elegido para el servicio elegido (A §3 hoja, §4 panel), en el estilo de
 * D-038: título con "Tu sector", el bloque de estado con el consenso, la estimación con su n (y la
 * barra si hay un corte en curso), el aviso pendiente, el botón de reportar y, completo, los
 * últimos cortes (VIS-04).
 */
export function DetalleSector({
  sectorId,
  nombre,
  servicio,
  propio,
  variante,
  completo,
}: {
  sectorId: number;
  nombre: string;
  servicio: TipoServicio;
  propio: boolean;
  variante: 'hoja' | 'panel';
  /** La hoja asomada solo enseña lo esencial; expandida o en el panel, todo. */
  completo: boolean;
}) {
  const { reloj } = usePuertos();
  const estados = useEstadosSector();
  const resumen = useResumen(sectorId);
  const configuracion = useConfiguracion();
  const cola = useColaAvisos();
  const perfil = usePerfil();
  const idTitulo = useId();

  const fila = estados.data?.find((e) => e.sectorId === sectorId && e.tipoServicio === servicio);
  const estado = estadoVisual(fila);
  const delServicio = resumen.data?.servicios.find((s) => s.tipoServicio === servicio);
  const consensoN = configuracion.data?.consensoN ?? CONSENSO_N_POR_DEFECTO;
  const nMin = configuracion.data?.estimacionNMin ?? ESTIMACION_N_MIN_POR_DEFECTO;
  const ahora = reloj.ahora();
  // El aviso es del vecino, y su sector es el propio: en otro sector no se muestra.
  const pendientes = propio
    ? (cola.data ?? []).filter((a) => a.estado === 'pendiente' && a.tipoServicio === servicio)
    : [];
  // Se reporta desde el propio sector; sin cuenta, el botón lleva a crearla.
  const puedeReportar = propio || !perfil.data;
  const panel = variante === 'panel';

  // La barra de la estimación solo tiene sentido con un corte en curso y su hora de inicio.
  const transcurrido =
    estado === 'sin-servicio' && fila?.desde ? minutosDesde(fila.desde, ahora) : undefined;

  return (
    <section aria-labelledby={idTitulo} className="flex flex-col">
      {/* El título no se corta: lo que distingue "Noroeste" de "Noreste" va al final. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h2
          id={idTitulo}
          className={`font-display leading-tight font-extrabold tracking-[-0.01em] ${panel ? 'text-[28px]' : 'text-2xl'} min-w-0 break-words`}
        >
          {nombre}
        </h2>
        {propio && (
          <span className="rounded-etiqueta bg-acento-suave px-2 py-0.5 text-[11px] font-extrabold tracking-[.06em] whitespace-nowrap text-tinta-acento uppercase">
            Tu sector
          </span>
        )}
      </div>

      {/* D-038: el estado como bloque, con el consenso a la vista. */}
      <div className={panel ? 'mt-4' : 'mt-2'}>
        <BloqueEstado
          estado={estado}
          servicio={servicio}
          fila={fila}
          eventos={delServicio?.ultimosEventos}
          consensoN={consensoN}
          ahora={ahora}
        />
      </div>

      <div className={panel ? 'mt-5' : 'mt-3'}>
        {resumen.isError ? (
          <p className="text-sm text-secundario">
            No hay una estimación guardada para mostrar sin conexión.
          </p>
        ) : (
          <BloqueEstimacion
            estimacion={delServicio?.estimacion}
            nMin={nMin}
            variante={variante}
            transcurridoMin={transcurrido}
          />
        )}
      </div>

      {pendientes.map((aviso) => (
        <p
          key={aviso.id}
          className="mt-3 flex items-start gap-2.5 rounded-bloque bg-estado-sin-confirmar-chip px-3 py-2.5 text-sm leading-[1.35] text-estado-sin-confirmar-tinta"
        >
          <Icono nombre="clock" tamano={18} grosor={2.2} className="mt-px" />
          {textoAvisoPendiente(aviso)}
        </p>
      ))}

      {/* D-038: el botón ya se ve con la hoja asomada; reportar queda a un toque del estado. */}
      {puedeReportar && (
        <Boton
          ancho
          className={panel ? 'mt-5' : 'mt-3.5'}
          onClick={() => navegar('/reportar', { consulta: { servicio } })}
        >
          {textoBotonPrincipal(estado, servicio)}
        </Boton>
      )}

      {completo && (
        <>
          <UltimosCortes
            eventos={delServicio?.ultimosEventos}
            cargando={resumen.isPending}
            ahora={ahora}
          />
          <Enlace
            a="/panel"
            className="mt-4 inline-flex min-h-11 items-center gap-2 self-start text-sm font-semibold text-acento"
          >
            <Icono nombre="grid" tamano={18} />
            Ver todos los sectores en una lista
          </Enlace>
        </>
      )}
    </section>
  );
}

function UltimosCortes({
  eventos,
  cargando,
  ahora,
}: {
  eventos: readonly EventoSectorDto[] | undefined;
  cargando: boolean;
  ahora: string;
}) {
  return (
    <div className="mt-6">
      <h3 className="mb-1 text-base font-bold">Últimos cortes</h3>
      {cargando ? (
        <div className="flex flex-col gap-2 pt-2">
          <Esqueleto className="h-10" />
          <Esqueleto className="h-10" />
        </div>
      ) : !eventos?.length ? (
        <p className="border-t border-borde py-3 text-sm text-secundario">
          Todavía no hay cortes registrados en este sector.
        </p>
      ) : (
        <ul>
          {eventos.slice(0, 5).map((evento) => {
            const minutos = duracionDe(evento);
            return (
              <li
                key={evento.id}
                className="flex items-center justify-between gap-3 border-t border-borde py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{diaRelativo(evento.inicioEn, ahora)}</p>
                  <p className="text-[13px] text-secundario tabular-nums">
                    {intervaloCorte(evento)}
                  </p>
                </div>
                {evento.finEn === null ? (
                  <span className="rounded-chip bg-estado-sin-servicio-chip px-2.5 py-[3px] text-[13px] font-semibold whitespace-nowrap text-estado-sin-servicio-tinta">
                    En curso
                  </span>
                ) : (
                  <span className="text-sm font-semibold whitespace-nowrap tabular-nums">
                    {minutos === null ? '—' : duracion(minutos)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
