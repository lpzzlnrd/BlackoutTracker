import type { EventoSectorDto, TipoServicio } from '@blackout/shared';
import { Icono, type NombreIcono } from '../componentes/ui/Icono';
import type { EstadoSector, EstadoVisual } from '../dominio/tipos';
import { hora } from '../utils/formato';
import { lineaEstado, textoConsenso, titularEstado } from './textos';

// El estado del sector como bloque (D-038): el corte es lo único sólido y ruidoso; los demás
// estados van en el tono suave de su chip, para que no compitan con él (D-035). Siempre color +
// icono + texto (CANON §1.2).

const TONO: Record<Exclude<EstadoVisual, 'sin-servicio'>, string> = {
  'sin-confirmar': 'bg-estado-sin-confirmar-chip text-estado-sin-confirmar-tinta',
  'con-servicio': 'bg-estado-con-servicio-chip text-estado-con-servicio-tinta',
  'sin-datos': 'bg-estado-sin-datos-chip text-estado-sin-datos-tinta',
};

const ICONO: Record<EstadoVisual, NombreIcono> = {
  'sin-servicio': 'x-circle',
  'sin-confirmar': 'help-circle',
  'con-servicio': 'check-circle',
  'sin-datos': 'minus-circle',
};

export function BloqueEstado({
  estado,
  servicio,
  fila,
  eventos,
  consensoN,
  ahora,
}: {
  estado: EstadoVisual;
  servicio: TipoServicio;
  fila: EstadoSector | undefined;
  eventos: readonly EventoSectorDto[] | undefined;
  consensoN: number;
  ahora: string;
}) {
  const titular = titularEstado(estado, servicio);

  if (estado === 'sin-servicio') {
    return (
      <div className="flex flex-col gap-2 rounded-tarjeta bg-estado-sin-servicio-relleno px-4 py-3 text-sobre-estado">
        {/* En el panel de escritorio, más angosto, la hora pasa debajo en vez de apretarse. */}
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <Icono nombre={ICONO[estado]} tamano={26} grosor={2.4} />
          <p className="font-display text-[30px] leading-none font-extrabold tracking-[-0.02em]">
            {titular}
          </p>
          {fila?.desde && (
            <p className="ml-auto text-sm font-semibold whitespace-nowrap">
              desde las{' '}
              <span className="font-display text-xl font-extrabold tabular-nums">
                {hora(fila.desde)}
              </span>
            </p>
          )}
        </div>
        <Consenso llenas={consensoN} total={consensoN} texto={textoConsenso(consensoN)} />
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-2 rounded-tarjeta px-4 py-3 ${TONO[estado]}`}>
      <div className="flex items-center gap-2.5">
        <Icono nombre={ICONO[estado]} tamano={24} grosor={2.2} />
        <p className="font-display text-2xl leading-none font-extrabold tracking-[-0.02em]">
          {titular}
        </p>
      </div>
      {estado === 'sin-confirmar' ? (
        <Consenso
          llenas={fila?.reportesSinConfirmar ?? 0}
          total={consensoN}
          texto={lineaEstado({ estado, fila, eventos, consensoN, ahora })}
        />
      ) : (
        <p className="text-sm">{lineaEstado({ estado, fila, eventos, consensoN, ahora })}</p>
      )}
    </div>
  );
}

/**
 * El consenso a la vista (CON-01): una barrita por vecino que hace falta, llenas las que ya
 * reportaron. Toma el color del texto del bloque. El texto dice lo mismo para el lector.
 */
function Consenso({ llenas, total, texto }: { llenas: number; total: number; texto: string }) {
  return (
    <p className="flex items-center gap-2 text-[13px] font-semibold">
      <span aria-hidden="true" className="flex flex-none gap-[3px]">
        {Array.from({ length: Math.min(total, 10) }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 w-[18px] rounded-[3px] bg-current ${i < llenas ? '' : 'opacity-30'}`}
          />
        ))}
      </span>
      {texto}
    </p>
  );
}
