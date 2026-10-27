import type { EstimacionDto, TipoServicio } from '@blackout/shared';
import { Esqueleto } from '../componentes/ui/Mensaje';
import { useEstimacion } from '../datos/consultas';
import { ETIQUETA_ESTADO } from '../dominio/estado-visual';
import type { FilaPanel } from '../dominio/panel';
import { recuentoPorEstado } from '../dominio/panel';
import type { EstadoVisual } from '../dominio/tipos';
import { duracion, estimacionAprox, segunCortes } from '../utils/formato';

// Piezas pequeñas del Panel. Cada fila pide su propia estimación: no hay una llamada para todos los
// sectores (la petición P3 no existe), y con 4 sectores son 4 consultas cacheadas.

/** Etiqueta "Tu sector" (D-038: mayúsculas de 11 px sobre `--acento-suave`, como en el mapa). */
export function EtiquetaTuSector() {
  return (
    <span className="inline-block rounded-etiqueta bg-acento-suave px-2 py-0.5 text-[11px] font-extrabold tracking-[.06em] whitespace-nowrap text-tinta-acento uppercase">
      Tu sector
    </span>
  );
}

/** "aprox. 4 h · según 12 cortes registrados" o "Datos insuficientes · 3 de 5 cortes registrados". */
export function textoEstimacion(estimacion: EstimacionDto, nMin: number): [string, string] {
  return estimacion.suficiente
    ? [estimacionAprox(estimacion.medianaMin), segunCortes(estimacion.n)]
    : ['Datos insuficientes', `${estimacion.n} de ${nMin} cortes registrados`];
}

/**
 * La estimación a la derecha de la tarjeta del teléfono (D-038): "aprox." encima de la cifra y el
 * n debajo; con pocos cortes, "Datos insuficientes" sin cifra (EST-04). Siempre con su n.
 */
export function CifraEstimacion({
  sectorId,
  servicio,
  nMin,
}: {
  sectorId: number;
  servicio: TipoServicio;
  nMin: number;
}) {
  const { data } = useEstimacion(sectorId, servicio);
  if (!data) return <Esqueleto className="h-11 w-14" />;
  return data.suficiente ? (
    <p className="flex flex-none flex-col items-end text-right">
      <span className="text-[11px] font-semibold text-secundario">aprox.</span>
      <span className="font-display text-xl leading-tight font-extrabold whitespace-nowrap tabular-nums">
        {duracion(data.medianaMin)}
      </span>
      <span className="text-[11px] text-secundario tabular-nums">{data.n} cortes</span>
    </p>
  ) : (
    <p className="flex flex-none flex-col items-end text-right">
      <span className="text-xs leading-tight font-bold text-texto-2">
        Datos
        <br />
        insuficientes
      </span>
      <span className="text-[11px] text-secundario tabular-nums">
        {data.n} de {nMin} cortes
      </span>
    </p>
  );
}

const Raya = () => <span className="text-secundario">—</span>;

/** Las celdas Estimación · Rango habitual · Cortes de la tabla de escritorio. */
export function CeldasEstimacion({
  sectorId,
  servicio,
  nMin,
}: {
  sectorId: number;
  servicio: TipoServicio;
  nMin: number;
}) {
  const { data } = useEstimacion(sectorId, servicio);
  const celda = 'border-b border-borde px-2.5 py-3';
  if (!data) {
    return (
      <>
        <td className={celda}>
          <Esqueleto className="h-5 w-24" />
        </td>
        <td className={celda}>
          <Esqueleto className="h-5 w-24" />
        </td>
        <td className={`${celda} pr-4`}>
          <Esqueleto className="ml-auto h-5 w-10" />
        </td>
      </>
    );
  }
  const rango =
    data.suficiente && data.q1Min !== undefined && data.q3Min !== undefined
      ? `${duracion(Math.round(data.q1Min))} – ${duracion(Math.round(data.q3Min))}`
      : null;
  return (
    <>
      <td className={`${celda} font-semibold tabular-nums`}>
        {data.suficiente ? estimacionAprox(data.medianaMin) : 'Datos insuficientes'}
      </td>
      <td className={`${celda} tabular-nums`}>{rango ?? <Raya />}</td>
      <td className={`${celda} pr-4 text-right tabular-nums`}>
        {data.suficiente ? data.n : `${data.n} de ${nMin}`}
      </td>
    </>
  );
}

const SEGMENTO: Record<EstadoVisual, string> = {
  'sin-servicio': 'bg-estado-sin-servicio-relleno',
  // La trama de "sin confirmar", la misma idea que en el mapa (CANON §1.2: nunca solo color). Las
  // rayas son tinta translúcida: el trazo del token se pierde sobre el ámbar en oscuro.
  'sin-confirmar':
    'bg-estado-sin-confirmar-relleno bg-[repeating-linear-gradient(135deg,rgb(0_0_0/0.3)_0_2px,transparent_2px_6px)]',
  'con-servicio': 'bg-estado-con-servicio-relleno',
  'sin-datos': 'bg-estado-sin-datos-relleno',
};

/**
 * Resumen del servicio elegido (D-038): una barra apilada con un tramo por sector, del peor estado
 * al mejor, y debajo cuántos sectores hay en cada estado. La barra es decorativa: los números y
 * los nombres de los estados van en texto.
 */
export function ResumenEstados({
  titulo,
  actualizado,
  filas,
}: {
  titulo: string;
  actualizado: string | null;
  filas: readonly FilaPanel[];
}) {
  const recuento = recuentoPorEstado(filas);
  return (
    <div className="flex flex-col gap-2.5 rounded-tarjeta border border-borde bg-superficie px-4 py-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2
          id="titulo-sectores"
          className="text-xs font-extrabold tracking-[.06em] text-secundario uppercase"
        >
          {titulo}
        </h2>
        {actualizado && <p className="text-xs text-secundario">{actualizado}</p>}
      </div>
      <div aria-hidden="true" className="flex h-3.5 gap-[3px]">
        {recuento.map(([estado, cantidad]) => (
          <span
            key={estado}
            className={`rounded-[4px] ${SEGMENTO[estado]}`}
            style={{ flex: `${cantidad} 1 0` }}
          />
        ))}
      </div>
      <ul
        aria-label="Sectores por estado"
        className="grid grid-cols-[repeat(auto-fit,minmax(min(96px,100%),1fr))] gap-2"
      >
        {recuento.map(([estado, cantidad]) => (
          <li key={estado}>
            <span className="block font-display text-2xl leading-none font-extrabold tabular-nums">
              {cantidad}
            </span>
            <span className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-secundario">
              <span aria-hidden="true" className={`h-2 w-2 rounded-[2px] ${SEGMENTO[estado]}`} />
              {ETIQUETA_ESTADO[estado]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
