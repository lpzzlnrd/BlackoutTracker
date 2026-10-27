import {
  CONSENSO_N_POR_DEFECTO,
  ESTIMACION_N_MIN_POR_DEFECTO,
  TipoServicio,
  type EventoSectorDto,
  type ResumenServicioDto,
} from '@blackout/shared';
import { Contenido } from '../componentes/marco/Marco';
import { BloqueEstimacion } from '../componentes/ui/BloqueEstimacion';
import { Boton } from '../componentes/ui/Boton';
import { Icono } from '../componentes/ui/Icono';
import { Esqueleto, Mensaje } from '../componentes/ui/Mensaje';
import { useConfiguracion, useHistorial, usePerfil, useResumen } from '../datos/consultas';
import { usePuertos } from '../datos/contexto';
import { ErrorApiCliente } from '../dominio/errores';
import { estadoVisual } from '../dominio/estado-visual';
import { intervalo } from '../dominio/panel';
import { BloqueEstado } from '../mapa/BloqueEstado';
import { minutosDesde } from '../mapa/textos';
import { Enlace } from '../navegacion/ruta';
import { diaRelativo, duracion, nombreServicio } from '../utils/formato';
import { EtiquetaTuSector } from './piezas';

// Detalle de un sector (VIS-04): por servicio, el estado, la estimación con su n y los cortes,
// del más reciente al más antiguo. Agua y luz van en bloques separados y nunca se mezclan (EST-05).
// El estado y la estimación usan los mismos bloques que el mapa (D-038).

const ORDEN = [TipoServicio.Electricidad, TipoServicio.Agua] as const;

function Volver() {
  return (
    <Enlace
      a="/panel"
      className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-semibold text-acento"
    >
      <Icono nombre="chevron-left" tamano={18} />
      Volver al panel
    </Enlace>
  );
}

export function DetalleSector({ sectorId }: { sectorId: number | null }) {
  const resumen = useResumen(sectorId ?? undefined);
  const perfil = usePerfil();
  const config = useConfiguracion();
  const nMin = config.data?.estimacionNMin ?? ESTIMACION_N_MIN_POR_DEFECTO;
  const consensoN = config.data?.consensoN ?? CONSENSO_N_POR_DEFECTO;

  const noExiste =
    sectorId === null || (resumen.error instanceof ErrorApiCliente && resumen.error.estado === 404);

  if (noExiste) {
    return (
      <Contenido>
        <Volver />
        <h1 className="font-display text-[32px] leading-[1.05] font-extrabold tracking-[-0.02em]">
          Sector
        </h1>
        <Mensaje tono="error">No encontramos ese sector.</Mensaje>
      </Contenido>
    );
  }

  if (!resumen.data) {
    return (
      <Contenido ancho="amplio">
        <Volver />
        {resumen.isPending ? (
          <>
            <Esqueleto className="h-8 w-48" />
            <div className="grid gap-5 lg:grid-cols-2">
              <Esqueleto className="h-80" />
              <Esqueleto className="h-80" />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-start gap-3">
            <h1 className="font-display text-[32px] leading-[1.05] font-extrabold tracking-[-0.02em]">
              Sector
            </h1>
            <Mensaje tono="error">
              Sin datos: no hay información guardada de este sector. Conéctate para verla.
            </Mensaje>
            <Boton variante="secundario" icono="refresh-cw" onClick={() => void resumen.refetch()}>
              Reintentar
            </Boton>
          </div>
        )}
      </Contenido>
    );
  }

  const { sectorNombre, servicios } = resumen.data;
  const propio = perfil.data?.sectorId === sectorId;

  return (
    <Contenido ancho="amplio">
      <Volver />
      <header className="flex flex-col items-start gap-2">
        {propio && <EtiquetaTuSector />}
        <h1 className="font-display text-[32px] leading-[1.05] font-extrabold tracking-[-0.02em]">
          {sectorNombre}
        </h1>
      </header>
      <div className="grid items-start gap-5 lg:grid-cols-2">
        {ORDEN.map((tipo) => {
          const servicio = servicios.find((s) => s.tipoServicio === tipo);
          return servicio ? (
            <BloqueServicio
              key={tipo}
              sectorId={sectorId}
              servicio={servicio}
              nMin={nMin}
              consensoN={consensoN}
            />
          ) : null;
        })}
      </div>
    </Contenido>
  );
}

function BloqueServicio({
  sectorId,
  servicio,
  nMin,
  consensoN,
}: {
  sectorId: number;
  servicio: ResumenServicioDto;
  nMin: number;
  consensoN: number;
}) {
  const { tipoServicio } = servicio;
  const fila = {
    sectorId,
    tipoServicio,
    estado: servicio.estado,
    reportesSinConfirmar: servicio.reportesSinConfirmar,
    desde: servicio.desde,
    actualizadoEn: '',
  };
  const ahora = usePuertos().reloj.ahora();
  const estado = estadoVisual(fila);
  const enCurso = servicio.ultimosEventos.find((e) => e.finEn === null);
  const idTitulo = `servicio-${tipoServicio}`;

  return (
    <section
      aria-labelledby={idTitulo}
      className="flex flex-col gap-4 rounded-tarjeta border border-borde bg-superficie p-4 lg:p-5"
    >
      <h2
        id={idTitulo}
        className="flex items-center gap-2 font-display text-xl leading-tight font-extrabold"
      >
        <Icono nombre={tipoServicio === TipoServicio.Electricidad ? 'zap' : 'droplet'} />
        {nombreServicio(tipoServicio)}
      </h2>
      <BloqueEstado
        estado={estado}
        servicio={tipoServicio}
        fila={fila}
        eventos={servicio.ultimosEventos}
        consensoN={consensoN}
        ahora={ahora}
      />
      <BloqueEstimacion
        estimacion={servicio.estimacion}
        nMin={nMin}
        variante="panel"
        transcurridoMin={
          estado === 'sin-servicio' && fila.desde ? minutosDesde(fila.desde, ahora) : undefined
        }
      />
      <Historial sectorId={sectorId} tipoServicio={tipoServicio} enCurso={enCurso} />
    </section>
  );
}

/** Cortes cerrados paginados ("Ver más") y, arriba, el que sigue en curso si lo hay. */
function Historial({
  sectorId,
  tipoServicio,
  enCurso,
}: {
  sectorId: number;
  tipoServicio: TipoServicio;
  enCurso: EventoSectorDto | undefined;
}) {
  const historial = useHistorial(sectorId, tipoServicio);
  const ahora = usePuertos().reloj.ahora();
  const cerrados = historial.data?.pages.flatMap((p) => p.eventos) ?? [];
  const eventos = enCurso ? [enCurso, ...cerrados] : cerrados;

  return (
    <div className="flex flex-col">
      <h3 className="mb-1 text-base font-bold">Últimos cortes</h3>
      {historial.isPending && !enCurso ? (
        <div className="flex flex-col gap-2 py-2">
          <Esqueleto className="h-11" />
          <Esqueleto className="h-11" />
        </div>
      ) : eventos.length === 0 ? (
        <p className="border-t border-borde py-3 text-sm text-secundario">
          {historial.isError
            ? 'No se pudo cargar el historial.'
            : `Todavía no hay cortes de ${nombreServicio(tipoServicio).toLowerCase()} registrados.`}
        </p>
      ) : (
        <ul>
          {eventos.map((evento) => (
            <li
              key={evento.id}
              className="flex items-center justify-between gap-3 border-t border-borde py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold">{diaRelativo(evento.inicioEn, ahora)}</p>
                <p className="text-[13px] text-secundario tabular-nums">{intervalo(evento)}</p>
              </div>
              {evento.finEn === null ? (
                <span className="rounded-chip bg-estado-sin-servicio-chip px-2.5 py-0.5 text-[13px] font-semibold whitespace-nowrap text-estado-sin-servicio-tinta">
                  En curso
                </span>
              ) : (
                <span className="text-sm font-semibold whitespace-nowrap tabular-nums">
                  {evento.duracionMin === null ? '—' : duracion(evento.duracionMin)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {historial.hasNextPage && (
        <Boton
          variante="secundario"
          ancho
          className="mt-2"
          cargando={historial.isFetchingNextPage}
          onClick={() => void historial.fetchNextPage()}
        >
          Ver más
        </Boton>
      )}
    </div>
  );
}
