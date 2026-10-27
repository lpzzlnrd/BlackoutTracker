import {
  CONSENSO_N_POR_DEFECTO,
  ESTIMACION_N_MIN_POR_DEFECTO,
  TipoServicio,
} from '@blackout/shared';
import { Contenido, EncabezadoPantalla } from '../componentes/marco/Marco';
import { Boton } from '../componentes/ui/Boton';
import { CuadroEstado, EstadoChip } from '../componentes/ui/Chips';
import { Consenso } from '../componentes/ui/Consenso';
import { Icono } from '../componentes/ui/Icono';
import { Esqueleto, Mensaje } from '../componentes/ui/Mensaje';
import { SelectorServicio } from '../componentes/ui/SelectorServicio';
import { useConfiguracion, useEstadosSector, usePerfil, useSectores } from '../datos/consultas';
import { useObservable, usePuertos } from '../datos/contexto';
import { useServicio } from '../datos/preferencias';
import {
  filasPanel,
  lineaEstado,
  lineaTarjeta,
  sectoresSinServicio,
  type FilaPanel,
} from '../dominio/panel';
import { useEsEscritorio } from '../mapa/HojaSector';
import { Enlace } from '../navegacion/ruta';
import { hora } from '../utils/formato';
import { CeldasEstimacion, CifraEstimacion, EtiquetaTuSector, ResumenEstados } from './piezas';

/** "La luz ahora" / "El agua ahora": el título del resumen (D-038). */
const TITULO_RESUMEN: Record<TipoServicio, string> = {
  [TipoServicio.Electricidad]: 'La luz ahora',
  [TipoServicio.Agua]: 'El agua ahora',
};

/**
 * La lista de sectores: la alternativa accesible al mapa (CANON §4.6). Arriba, el resumen del
 * servicio con su barra apilada (D-038); debajo, tarjetas en el teléfono y tabla desde 1024 px,
 * filtradas por el servicio elegido, que se comparte con el mapa (VIS-02).
 */
export function ListaSectores() {
  const [servicio, elegir] = useServicio();
  const sectores = useSectores();
  const estados = useEstadosSector();
  const perfil = usePerfil();
  const config = useConfiguracion();
  const estadoConexion = useObservable(usePuertos().conexion);
  const escritorio = useEsEscritorio();

  const nMin = config.data?.estimacionNMin ?? ESTIMACION_N_MIN_POR_DEFECTO;
  const consensoN = config.data?.consensoN ?? CONSENSO_N_POR_DEFECTO;
  const lista = (sectores.data?.features ?? []).map((f) => f.properties);
  const filas = filasPanel(lista, estados.data, servicio, perfil.data?.sectorId);
  const cortes = {
    [TipoServicio.Electricidad]: sectoresSinServicio(
      lista,
      estados.data,
      TipoServicio.Electricidad,
    ),
    [TipoServicio.Agua]: sectoresSinServicio(lista, estados.data, TipoServicio.Agua),
  };
  const actualizado = estadoConexion.ultimaSincronizacion
    ? `actualizado a las ${hora(estadoConexion.ultimaSincronizacion)}`
    : null;

  return (
    <Contenido ancho="amplio">
      <EncabezadoPantalla
        titulo="Panel"
        descripcion={
          lista.length > 0
            ? `Guaparo · ${lista.length} sectores`
            : 'El estado de cada sector y cuánto suele durar un corte.'
        }
      />
      <SelectorServicio
        valor={servicio}
        onChange={elegir}
        ancho={escritorio ? 120 : 'completo'}
        cortes={cortes}
      />

      <section aria-labelledby="titulo-sectores" className="flex flex-col gap-3">
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
            <ResumenEstados
              titulo={TITULO_RESUMEN[servicio]}
              actualizado={actualizado}
              filas={filas}
            />
            <ul aria-label="Sectores" className="flex flex-col gap-2 lg:hidden">
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
          Las cifras son una estimación estadística: la mediana de los cortes cerrados de cada
          sector. Con menos de {nMin} cortes no se muestra una cifra.
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

/**
 * Teléfono: cada sector es un enlace a su detalle (D-038): el cuadro del estado, el nombre con su
 * línea de estado (con las barritas del consenso si está sin confirmar) y la cifra a la derecha.
 */
function TarjetaSector({ fila, servicio, nMin, consensoN }: PropsFila & { fila: FilaPanel }) {
  const linea = lineaTarjeta(fila, servicio, consensoN);
  return (
    <Enlace
      a="/panel"
      consulta={{ sector: String(fila.sectorId) }}
      className="flex min-h-[72px] items-center gap-3 rounded-tarjeta border border-borde bg-superficie py-3 pr-2.5 pl-3"
    >
      <CuadroEstado estado={fila.estado} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-display text-[17px] leading-tight font-bold">{fila.nombre}</span>
          {fila.propio && <EtiquetaTuSector />}
        </span>
        {fila.estado === 'sin-confirmar' ? (
          <span className="text-secundario">
            {/* El cuadro del estado es decorativo: el lector oye el estado aquí. */}
            <span className="sr-only">Sin confirmar:</span>
            <Consenso
              llenas={fila.fila?.reportesSinConfirmar ?? 0}
              total={consensoN}
              texto={linea}
            />
          </span>
        ) : (
          <span className="text-[13px] text-secundario">{linea}</span>
        )}
      </div>
      <CifraEstimacion sectorId={fila.sectorId} servicio={servicio} nMin={nMin} />
      <Icono nombre="chevron-left" tamano={18} className="rotate-180 text-secundario" />
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
