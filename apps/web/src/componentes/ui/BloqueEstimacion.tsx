import type { EstimacionDto } from '@blackout/shared';
import { estimacionAprox, segunCortes } from '../../utils/formato';
import { Esqueleto } from './Mensaje';

/**
 * "Estimación estadística · aprox. 4 h · según 12 cortes registrados" (CANON §7.1). Con menos de
 * `nMin` cortes no hay cifra: "Datos insuficientes · 3 de 5 cortes registrados" (EST-04). Nunca
 * se dice "predicción".
 */
export function BloqueEstimacion({
  estimacion,
  nMin,
  variante = 'hoja',
}: {
  estimacion: EstimacionDto | undefined;
  nMin: number;
  /** `hoja`: en línea (26 px). `panel`: bloque gris de escritorio (32 px). */
  variante?: 'hoja' | 'panel';
}) {
  const grande = variante === 'panel' ? 'text-[32px]' : 'text-[26px]';
  return (
    <div className={variante === 'panel' ? 'rounded-bloque bg-superficie-2 p-4' : ''}>
      <p className="text-xs text-secundario">Estimación estadística</p>
      {!estimacion ? (
        <Esqueleto className="mt-1 h-8 w-48" />
      ) : estimacion.suficiente ? (
        <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
          <span className={`${grande} leading-tight font-bold whitespace-nowrap tabular-nums`}>
            {estimacionAprox(estimacion.medianaMin)}
          </span>
          <span className="text-sm text-secundario">{segunCortes(estimacion.n)}</span>
        </p>
      ) : (
        <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
          <span className="text-xl leading-tight font-bold">Datos insuficientes</span>
          <span className="text-sm text-secundario tabular-nums">
            {estimacion.n} de {nMin} cortes registrados
          </span>
        </p>
      )}
    </div>
  );
}
