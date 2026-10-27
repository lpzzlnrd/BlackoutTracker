import { TipoServicio } from '@blackout/shared';
import { nombreServicio } from '../../utils/formato';
import { Icono } from './Icono';

const OPCIONES = [TipoServicio.Electricidad, TipoServicio.Agua] as const;

/** Luz / Agua (CANON §8: grupo con `aria-pressed`). 120 px en el teléfono, 112 en escritorio. */
export function SelectorServicio({
  valor,
  onChange,
  ancho = 120,
}: {
  valor: TipoServicio;
  onChange: (servicio: TipoServicio) => void;
  ancho?: 112 | 120;
}) {
  return (
    <div
      role="group"
      aria-label="Servicio"
      className="inline-flex w-fit gap-1 rounded-tarjeta border border-borde bg-superficie p-1 shadow-flotante"
    >
      {OPCIONES.map((servicio) => {
        const elegido = servicio === valor;
        return (
          <button
            key={servicio}
            type="button"
            aria-pressed={elegido}
            onClick={() => onChange(servicio)}
            style={{ width: ancho }}
            className={`inline-flex h-11 items-center justify-center gap-2 rounded-control text-[15px] font-semibold ${
              elegido ? 'bg-acento text-sobre-acento' : 'text-texto-2'
            }`}
          >
            <Icono
              nombre={servicio === TipoServicio.Electricidad ? 'zap' : 'droplet'}
              tamano={18}
            />
            {nombreServicio(servicio)}
          </button>
        );
      })}
    </div>
  );
}
