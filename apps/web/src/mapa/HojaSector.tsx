import { useRef, useSyncExternalStore, type PointerEvent, type ReactNode } from 'react';
import { Icono } from '../componentes/ui/Icono';
import { AtribucionOSM } from './MapaBase';

// Hoja inferior del teléfono (A §5): oculta (una franja, para ver el mapa entero), asomada (con el
// estado y el botón de reportar, D-038), media y completa (hasta debajo del selector y la leyenda).
// Se mueve con el botón del tirador o arrastrándolo en vertical; el chevrón la oculta de un toque.

export type PosicionHoja = 'oculta' | 'asomada' | 'media' | 'completa';

const ORDEN: readonly PosicionHoja[] = ['oculta', 'asomada', 'media', 'completa'];

/**
 * Alto de la hoja oculta: un objetivo táctil de 44 px. El círculo de Reportar sobresale 24 px de la
 * barra (D-037) y se funde con la franja, que es del mismo color; por eso el texto va a la izquierda.
 */
export const ALTURA_OCULTA = 44;

/**
 * Alto de la hoja asomada (D-038): lo justo para el estado, la estimación con su barra y el botón
 * de reportar sin que los tape el círculo de Reportar, que sobresale 24 px de la barra (D-037); o
 * algo más de la mitad del mapa, si es más bajo.
 */
export const alturaAsomada = (altoMapa: number): number =>
  Math.round(Math.min(368, altoMapa * 0.52));

const ALTURA: Record<Exclude<PosicionHoja, 'oculta' | 'asomada'>, string> = {
  media: '68%',
  // Deja a la vista el selector y la leyenda (se puede cambiar de servicio con la hoja abierta) y,
  // entre ellos y la hoja, la atribución. La barra de la marca queda fuera del mapa (D-038).
  completa: 'calc(100% - 130px)',
};

/**
 * Un toque recorre asomada, media y completa (desde oculta, vuelve a asomada); un arrastre de más
 * de 30 px sube o baja una.
 */
const UMBRAL_ARRASTRE = 30;

export function HojaSector({
  posicion,
  asomada,
  onCambiar,
  children,
}: {
  posicion: PosicionHoja;
  /** Alto en px de la posición asomada (`alturaAsomada`). */
  asomada: number;
  onCambiar: (posicion: PosicionHoja) => void;
  children: ReactNode;
}) {
  const inicioY = useRef<number | null>(null);
  const huboArrastre = useRef(false);
  const indice = ORDEN.indexOf(posicion);

  const mover = (paso: number) => {
    const destino = ORDEN[Math.min(ORDEN.length - 1, Math.max(0, indice + paso))];
    if (destino) onCambiar(destino);
  };

  const alBajar = (evento: PointerEvent<HTMLButtonElement>) => {
    inicioY.current = evento.clientY;
    huboArrastre.current = false;
    evento.currentTarget.setPointerCapture(evento.pointerId);
  };

  const alSoltar = (evento: PointerEvent<HTMLButtonElement>) => {
    if (inicioY.current === null) return;
    const desplazamiento = evento.clientY - inicioY.current;
    inicioY.current = null;
    if (Math.abs(desplazamiento) < UMBRAL_ARRASTRE) return;
    huboArrastre.current = true;
    mover(desplazamiento < 0 ? 1 : -1);
  };

  const alPulsar = () => {
    // El clic que sigue a un arrastre ya se resolvió en `alSoltar`.
    if (huboArrastre.current) {
      huboArrastre.current = false;
      return;
    }
    onCambiar(posicion === 'completa' ? 'asomada' : (ORDEN[indice + 1] ?? 'completa'));
  };

  const alto =
    posicion === 'oculta' ? ALTURA_OCULTA : posicion === 'asomada' ? asomada : ALTURA[posicion];

  return (
    <div className="hoja-sector absolute inset-x-0 bottom-0 z-[1000]" style={{ height: alto }}>
      {/* La atribución sigue al borde superior de la hoja: nunca queda tapada (CANON §4.1). */}
      <AtribucionOSM className="absolute right-2 bottom-full mb-1.5" />
      <div className="flex h-full flex-col rounded-t-hoja border-x border-t border-borde bg-superficie">
        {posicion === 'oculta' ? (
          <button
            type="button"
            aria-expanded={false}
            onClick={alPulsar}
            onPointerDown={alBajar}
            onPointerUp={alSoltar}
            className="flex h-full w-full touch-none items-center gap-2 px-5 text-sm font-semibold"
          >
            <Icono nombre="chevron-up" tamano={18} />
            Ver detalle
          </button>
        ) : (
          <>
            <div className="relative flex-none">
              <button
                type="button"
                aria-label={posicion === 'completa' ? 'Contraer detalle' : 'Expandir detalle'}
                aria-expanded={posicion !== 'asomada'}
                onClick={alPulsar}
                onPointerDown={alBajar}
                onPointerUp={alSoltar}
                className="flex h-11 w-full touch-none items-start justify-center pt-2"
              >
                <span className="h-1 w-10 rounded-[2px] bg-borde-2" />
              </button>
              <button
                type="button"
                aria-label="Ocultar detalle"
                onClick={() => onCambiar('oculta')}
                className="absolute top-0 right-1 grid h-11 w-11 place-items-center text-secundario"
              >
                <Icono nombre="chevron-down" tamano={20} />
              </button>
            </div>
            {/* 32 px abajo: el botón de Reportar sobresale 24 px de la barra (D-037) y no debe
                tapar lo último de la hoja al hacer scroll. */}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8">{children}</div>
          </>
        )}
      </div>
    </div>
  );
}

const CONSULTA_ESCRITORIO = '(min-width: 1024px)';

/** ¿Diseño de escritorio? Un solo punto de quiebre, 1024 px (CANON §2). */
export function useEsEscritorio(): boolean {
  return useSyncExternalStore(
    (avisar) => {
      const medio = matchMedia(CONSULTA_ESCRITORIO);
      medio.addEventListener('change', avisar);
      return () => medio.removeEventListener('change', avisar);
    },
    () => matchMedia(CONSULTA_ESCRITORIO).matches,
  );
}
