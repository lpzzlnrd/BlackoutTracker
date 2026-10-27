import {
  CONSENSO_N_POR_DEFECTO,
  ESTIMACION_N_MIN_POR_DEFECTO,
  type TipoServicio,
} from '@blackout/shared';
import { Contenido, EncabezadoPantalla } from '../componentes/marco/Marco';
import { Boton } from '../componentes/ui/Boton';
import { EstadoChip } from '../componentes/ui/Chips';
import { Icono } from '../componentes/ui/Icono';
import { Esqueleto, Mensaje } from '../componentes/ui/Mensaje';
import { SelectorServicio } from '../componentes/ui/SelectorServicio';
import { useConfiguracion, useEstadosSector, usePerfil, useSectores } from '../datos/consultas';
import { useObservable, usePuertos } from '../datos/contexto';
import { useServicio } from '../datos/preferencias';
import { filasPanel, lineaEstado, type FilaPanel } from '../dominio/panel';
import { Enlace } from '../navegacion/ruta';
import { hora, nombreServicio } from '../utils/formato';
import { CeldasEstimacion, EtiquetaTuSector, LineaEstimacion, RecuentoEstados } from './piezas';

/**
 * La lista de sectores: la alternativa accesible al mapa (CANON §4.6). Tarjetas en el teléfono y
 * tabla desde 1024 px, filtradas por el servicio elegido, que se comparte con el mapa (VIS-02).
 */
export function ListaSectores() {
  const [servicio, elegir] = useServicio();
  const sectores = useSectores();
  const estados = useEstadosSector();
  const perfil = usePerfil();
  const config = useConfiguracion();
  const estadoConexion = useObservable(usePuertos().conexion);

  const nMin = config.data?.estimacionNMin ?? ESTIMACION_N_MIN_POR_DEFECTO;
  const consensoN = config.data?.consensoN ?? CONSENSO_N_POR_DEFECTO;
  const lista = (sectores.data?.features ?? []).map((f) => f.properties);
  const filas = filasPanel(lista, estados.data, servicio, perfil.data?.sectorId);
  const actualizado = estadoConexion.ultimaSincronizacion
    ? ` · actualizado a las ${hora(estadoConexion.ultimaSincronizacion)}`
    : '';

  return (
    <Contenido ancho="amplio">
      <EncabezadoPantalla
        titulo="Panel"
        descripcion="El estado de cada sector, cuánto suele durar un corte y los cortes anteriores."
      />
      <SelectorServicio valor={servicio} onChange={elegir} />

      <section aria-labelledby="titulo-sectores" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 id="titulo-sectores" className="text-xl leading-tight font-bold">
            Sectores · {nombreServicio(servicio)}
          </h2>
          {lista.length > 0 && (
            <p className="text-[13px] text-secundario">
              {lista.length} sectores{actualizado}
            </p>
          )}
        </div>

        {sectores.isPending ? (
          <div className="flex flex-col gap-2">
            <Esqueleto className="h-24" />
            <Esqueleto className="h-24" />
            <Esqueleto className="h-24" />
          </div>
        ) : !sectores.data ? (
          <div className="flex flex-col items-start gap-3">
            <Mensaje tono="error">
              Sin datos: no hay información guardada de los sectores. Conéctate para verlos.
            </Mensaje>
            <Boton variante="secundario" icono="refresh-cw" onClick={() => void sectores.refetch()}>
              Reintentar
            </Boton>
          </div>
        ) : (
          <>
            <RecuentoEstados filas={filas} />
            <ul className="flex flex-col gap-2 lg:hidden">
              {filas.map((fila) => (
                <li key={fila.sectorId}>
                  <TarjetaSector
                    fila={fila}
                    servicio={servicio}
                    nMin={nMin}
                    consensoN={consensoN}
                  />
                </li>
              ))}
            </ul>
            <TablaSectores filas={filas} servicio={servicio} nMin={nMin} consensoN={consensoN} />
          </>
        )}

        <p className="text-xs leading-normal text-secundario">
          La estimación es la mediana de los cortes cerrados del sector. Con menos de {nMin} cortes
          no se muestra una cifra.
        </p>
      </section>
    </Contenido>
  );
}

interface PropsFila {
  servicio: TipoServicio;
  nMin: number;
  consensoN: number;
}

/** Teléfono: cada sector es un enlace a su detalle. */
function TarjetaSector({ fila, servicio, nMin, consensoN }: PropsFila & { fila: FilaPanel }) {
  const linea = lineaEstado(fila.fila, consensoN);
  return (
    <Enlace
      a="/panel"
      consulta={{ sector: String(fila.sectorId) }}
      className="flex items-center gap-3 rounded-tarjeta border border-borde bg-superficie p-4"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-base font-bold">{fila.nombre}</span>
            {fila.propio && <EtiquetaTuSector />}
          </span>
          <EstadoChip estado={fila.estado} />
        </div>
        {linea && <p className="text-sm text-secundario">{linea}</p>}
        <LineaEstimacion sectorId={fila.sectorId} servicio={servicio} nMin={nMin} />
      </div>
      <Icono nombre="chevron-left" tamano={20} className="rotate-180 text-secundario" />
    </Enlace>
  );
}

/** Escritorio: tabla en un contenedor con scroll propio; nunca se parte una celda (CANON §2). */
function TablaSectores({ filas, servicio, nMin, consensoN }: PropsFila & { filas: FilaPanel[] }) {
  const th = 'border-y border-borde px-2.5 py-2 text-left text-xs font-semibold text-secundario';
  const td = 'border-b border-borde px-2.5 py-3';
  return (
    <div className="hidden overflow-x-auto rounded-tarjeta border border-borde bg-superficie lg:block">
      <table className="w-full text-sm whitespace-nowrap [&_tbody_tr:last-child>*]:border-b-0">
        <thead className="bg-superficie-2">
          <tr>
            <th scope="col" className={`${th} pl-4`}>
              Sector
            </th>
            <th scope="col" className={th}>
              Estado
            </th>
            <th scope="col" className={th}>
              Desde
            </th>
            <th scope="col" className={th}>
              Estimación (mediana)
            </th>
            <th scope="col" className={th}>
              Rango habitual (cuartiles)
            </th>
            <th scope="col" className={`${th} pr-4 text-right`}>
              Cortes
            </th>
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => {
            const sinConfirmar =
              fila.estado === 'sin-confirmar' ? lineaEstado(fila.fila, consensoN) : null;
            return (
              <tr key={fila.sectorId}>
                <th scope="row" className={`${td} pl-4 text-left font-semibold`}>
                  <span className="inline-flex items-center gap-3">
                    <Enlace
                      a="/panel"
                      consulta={{ sector: String(fila.sectorId) }}
                      className="inline-flex min-h-11 items-center text-acento underline-offset-2 [@media(hover:hover)]:hover:underline"
                    >
                      {fila.nombre}
                    </Enlace>
                    {fila.propio && <EtiquetaTuSector />}
                  </span>
                </th>
                <td className={td}>
                  <EstadoChip estado={fila.estado} variante="compacto" />
                  {sinConfirmar && <p className="mt-1 text-xs text-secundario">{sinConfirmar}</p>}
                </td>
                <td className={`${td} tabular-nums`}>
                  {fila.estado === 'sin-servicio' && fila.fila?.desde ? (
                    hora(fila.fila.desde)
                  ) : (
                    <span className="text-secundario">—</span>
                  )}
                </td>
                <CeldasEstimacion sectorId={fila.sectorId} servicio={servicio} nMin={nMin} />
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
