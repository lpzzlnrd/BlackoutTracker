import type { EstimacionDto } from '@blackout/shared';
import { barraEstimacion } from '../../dominio/barra-estimacion';
import { duracion, segunCortes } from '../../utils/formato';
import { Esqueleto } from './Mensaje';

/**
 * "Estimación estadística · aprox. 4 h · según 12 cortes registrados" (CANON §7.1). Con menos de
 * `nMin` cortes no hay cifra: "Datos insuficientes · 3 de 5 cortes registrados" (EST-04). Nunca
 * se dice "predicción". Con un corte en curso, la barra de D-038 pone lo que lleva junto a la
 * mediana y al rango habitual (los cuartiles).
 */
export function BloqueEstimacion({
  estimacion,
  nMin,
  variante = 'hoja',
  transcurridoMin,
}: {
  estimacion: EstimacionDto | undefined;
  nMin: number;
  /** `hoja`: en línea (28 px). `panel`: bloque gris de escritorio (32 px). */
  variante?: 'hoja' | 'panel';
  /** Minutos que lleva el corte en curso del sector; sin corte, no hay barra. */
  transcurridoMin?: number;
}) {
  const grande = variante === 'panel' ? 'text-[32px]' : 'text-[28px]';
  const rango =
    estimacion?.suficiente && estimacion.q1Min !== undefined && estimacion.q3Min !== undefined
      ? `entre ${duracion(Math.round(estimacion.q1Min))} y ${duracion(Math.round(estimacion.q3Min))}`
      : null;
  // "Llevas 46 min · lo habitual: entre 2 h 30 min y 6 h"; sin corte en curso, solo el rango.
  const partes = [
    transcurridoMin !== undefined ? `Llevas ${duracion(transcurridoMin)}` : null,
    rango ? `lo habitual: ${rango}` : null,
  ].filter((parte) => parte !== null);
  const apoyo = partes.join(' · ').replace(/^l/, 'L');
  return (
    <div className={variante === 'panel' ? 'rounded-bloque bg-superficie-2 p-4' : ''}>
      <p className="text-xs font-semibold text-secundario">Estimación estadística</p>
      {!estimacion ? (
        <Esqueleto className="mt-1 h-8 w-48" />
      ) : estimacion.suficiente ? (
        <>
          <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
            <span
              className={`font-display ${grande} leading-tight font-extrabold whitespace-nowrap tabular-nums`}
            >
              <span className="text-base font-bold">aprox.</span> {duracion(estimacion.medianaMin)}
            </span>
            <span className="text-[13px] text-secundario">{segunCortes(estimacion.n)}</span>
          </p>
          {transcurridoMin !== undefined && (
            <Barra
              {...barraEstimacion({
                medianaMin: estimacion.medianaMin,
                q1Min: estimacion.q1Min,
                q3Min: estimacion.q3Min,
                transcurridoMin,
              })}
            />
          )}
          {apoyo && <p className="mt-1.5 text-xs text-secundario">{apoyo}</p>}
        </>
      ) : (
        <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
          <span className="font-display text-xl leading-tight font-extrabold">
            Datos insuficientes
          </span>
          <span className="text-sm text-secundario tabular-nums">
            {estimacion.n} de {nMin} cortes registrados
          </span>
        </p>
      )}
    </div>
  );
}

/**
 * La barra: el tramo del corte en curso (bermellón, es el estado "sin servicio"), el rango
 * habitual sombreado y una marca en la mediana. Es decorativa: lo mismo va en texto debajo.
 */
function Barra({ transcurrido, mediana, rango }: ReturnType<typeof barraEstimacion>) {
  return (
    <div aria-hidden="true" className="relative mt-2.5 h-2 rounded-[4px] bg-borde">
      {rango && (
        <span
          className="absolute inset-y-0 bg-borde-2"
          style={{ left: `${rango[0]}%`, width: `${rango[1] - rango[0]}%` }}
        />
      )}
      <span
        className="absolute inset-y-0 left-0 rounded-[4px] bg-estado-sin-servicio-relleno"
        style={{ width: `${transcurrido}%` }}
      />
      <span
        className="absolute -top-[3px] -ml-px h-3.5 w-0.5 rounded-[1px] bg-texto"
        style={{ left: `${mediana}%` }}
      />
    </div>
  );
}
