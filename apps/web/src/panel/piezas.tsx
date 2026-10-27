import type { EstimacionDto, TipoServicio } from '@blackout/shared';
import { EstadoChip } from '../componentes/ui/Chips';
import { Esqueleto } from '../componentes/ui/Mensaje';
import { useEstimacion } from '../datos/consultas';
import type { FilaPanel } from '../dominio/panel';
import { recuentoPorEstado } from '../dominio/panel';
import { duracion, estimacionAprox, segunCortes } from '../utils/formato';

// Piezas pequeñas del Panel. Cada fila pide su propia estimación: no hay una llamada para todos los
// sectores (la petición P3 no existe), y con 4 sectores son 4 consultas cacheadas.

/** Etiqueta "Tu sector" (A §4: `--acento-suave` con `--tinta-acento`, 12 / 700). */
export function EtiquetaTuSector() {
  return (
    <span className="inline-block rounded-etiqueta bg-acento-suave px-2 py-0.5 text-xs font-bold whitespace-nowrap text-tinta-acento">
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

/** La estimación en una línea, para las tarjetas del teléfono. */
export function LineaEstimacion({
  sectorId,
  servicio,
  nMin,
}: {
  sectorId: number;
  servicio: TipoServicio;
  nMin: number;
}) {
  const { data } = useEstimacion(sectorId, servicio);
  if (!data) return <Esqueleto className="h-5 w-56" />;
  const [cifra, apoyo] = textoEstimacion(data, nMin);
  return (
    <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
      <span className="font-semibold tabular-nums">{cifra}</span>
      <span className="text-secundario">{apoyo}</span>
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

/** Recuento por estado con chips compactos: "1 · Sin servicio", "2 · Con servicio"… */
export function RecuentoEstados({ filas }: { filas: readonly FilaPanel[] }) {
  return (
    <ul aria-label="Sectores por estado" className="flex flex-wrap gap-2">
      {recuentoPorEstado(filas).map(([estado, cantidad]) => (
        <li key={estado} className="inline-flex items-center gap-1.5">
          <span className="text-sm font-bold tabular-nums">{cantidad}</span>
          <EstadoChip estado={estado} variante="compacto" />
        </li>
      ))}
    </ul>
  );
}
