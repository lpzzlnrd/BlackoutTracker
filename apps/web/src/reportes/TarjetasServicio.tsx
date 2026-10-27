import { TipoServicio } from '@blackout/shared';
import type { CorteAbierto } from '../aplicacion/corte-abierto';
import { Icono } from '../componentes/ui/Icono';
import { hora, nombreServicio } from '../utils/formato';

const OPCIONES = [TipoServicio.Electricidad, TipoServicio.Agua] as const;

/**
 * Luz y Agua como dos tarjetas grandes (D-038). Cada una dice si el vecino tiene un corte propio
 * abierto de ese servicio, que es lo que decide el aviso (D-031). Es el mismo grupo con
 * `aria-pressed` que el selector (CANON §8).
 */
export function TarjetasServicio({
  valor,
  onChange,
  abiertos,
}: {
  valor: TipoServicio;
  onChange: (servicio: TipoServicio) => void;
  abiertos: Readonly<Record<TipoServicio, CorteAbierto | null>>;
}) {
  return (
    <div role="group" aria-label="Servicio" className="grid grid-cols-2 gap-2.5">
      {OPCIONES.map((servicio) => {
        const elegido = servicio === valor;
        const abierto = abiertos[servicio];
        return (
          <button
            key={servicio}
            type="button"
            aria-pressed={elegido}
            onClick={() => onChange(servicio)}
            className={`relative flex h-[104px] min-w-0 flex-col justify-between rounded-tarjeta p-3.5 text-left ${
              elegido
                ? 'bg-acento text-sobre-acento'
                : 'border border-borde bg-superficie text-texto'
            }`}
          >
            <Icono
              nombre={servicio === TipoServicio.Electricidad ? 'zap' : 'droplet'}
              tamano={24}
              grosor={2.2}
            />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="font-display text-[22px] leading-none font-extrabold">
                {nombreServicio(servicio)}
              </span>
              {/* Arriba a la derecha, pero después del nombre en el orden de lectura: el
                  lector oye "Luz, Corte abierto, Desde las 14:20". */}
              {abierto && (
                <span className="absolute top-4 right-3.5 rounded-chip bg-estado-sin-servicio-relleno px-2 py-0.5 text-[11px] font-extrabold whitespace-nowrap text-sobre-estado">
                  Corte abierto
                </span>
              )}
              <span
                className={`truncate text-[13px] ${elegido ? 'font-semibold opacity-85' : 'text-secundario'}`}
              >
                {abierto ? `Desde las ${hora(abierto.inicioEn)}` : 'Sin cortes tuyos'}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
