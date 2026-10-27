import { TipoServicio } from '@blackout/shared';
import { nombreServicio } from '../../utils/formato';
import { Icono } from './Icono';

const OPCIONES = [TipoServicio.Electricidad, TipoServicio.Agua] as const;

const sectoresSinServicio = (n: number) =>
  `${n} ${n === 1 ? 'sector sin servicio' : 'sectores sin servicio'}`;

/**
 * Luz / Agua (CANON §8: grupo con `aria-pressed`). 120 px en el teléfono, 112 en escritorio, o
 * `completo` a todo el ancho (D-038). Con `cortes`, cada botón dice cuántos sectores están sin ese
 * servicio, en una insignia bermellón (el color del estado) y en su nombre accesible.
 */
export function SelectorServicio({
  valor,
  onChange,
  ancho = 120,
  cortes,
}: {
  valor: TipoServicio;
  onChange: (servicio: TipoServicio) => void;
  ancho?: 112 | 120 | 'completo';
  cortes?: Partial<Record<TipoServicio, number>>;
}) {
  const completo = ancho === 'completo';
  return (
    <div
      role="group"
      aria-label="Servicio"
      className={`${completo ? 'flex w-full' : 'inline-flex w-fit'} gap-1 rounded-tarjeta border border-borde bg-superficie p-1`}
    >
      {OPCIONES.map((servicio) => {
        const elegido = servicio === valor;
        const sinServicio = cortes?.[servicio] ?? 0;
        return (
          <button
            key={servicio}
            type="button"
            aria-pressed={elegido}
            onClick={() => onChange(servicio)}
            style={completo ? undefined : { width: ancho }}
            className={`inline-flex h-11 items-center justify-center gap-2 rounded-control text-[15px] ${
              completo ? 'flex-1' : ''
            } ${elegido ? 'bg-acento font-bold text-sobre-acento' : 'font-semibold text-texto-2'}`}
          >
            <Icono
              nombre={servicio === TipoServicio.Electricidad ? 'zap' : 'droplet'}
              tamano={18}
            />
            {nombreServicio(servicio)}
            {sinServicio > 0 && (
              <>
                <span
                  aria-hidden="true"
                  className="grid h-5 min-w-5 place-items-center rounded-chip bg-estado-sin-servicio-relleno px-1.5 text-xs font-extrabold text-sobre-estado tabular-nums"
                >
                  {sinServicio}
                </span>
                <span className="sr-only">, {sectoresSinServicio(sinServicio)}</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
