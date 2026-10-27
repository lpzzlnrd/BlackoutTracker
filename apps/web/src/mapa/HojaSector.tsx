import { useRef, useSyncExternalStore, type PointerEvent, type ReactNode } from 'react';
import { AtribucionOSM } from './MapaBase';

// Hoja inferior del teléfono (A §5): asomada (la maqueta, 250 px), media y completa (hasta debajo
// de la barra flotante). Se mueve con el botón del tirador o arrastrándolo en vertical.

export type PosicionHoja = 'asomada' | 'media' | 'completa';

const ORDEN: readonly PosicionHoja[] = ['asomada', 'media', 'completa'];

/** Alto de la hoja asomada: 250 px como la maqueta, o el 40 % del mapa si es más bajo. */
export const alturaAsomada = (altoMapa: number): number =>
  Math.round(Math.min(250, altoMapa * 0.4));

const ALTURA: Record<Exclude<PosicionHoja, 'asomada'>, string> = {
  media: '55%',
  // Deja a la vista la barra, el selector y la leyenda (se puede cambiar de servicio con la hoja
  // abierta) y, entre ellos y la hoja, la atribución.
  completa: 'calc(100% - 172px)',
};

/** Un toque recorre las tres posiciones; un arrastre de más de 30 px sube o baja una. */
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

  return (
    <div
      className="hoja-sector absolute inset-x-0 bottom-0 z-[1000]"
      style={{ height: posicion === 'asomada' ? asomada : ALTURA[posicion] }}
    >
      {/* La atribución sigue al borde superior de la hoja: nunca queda tapada (CANON §4.1). */}
      <AtribucionOSM className="absolute right-2 bottom-full mb-1.5" />
      <div className="flex h-full flex-col rounded-t-hoja border-x border-t border-borde bg-superficie">
        <button
          type="button"
          aria-label={posicion === 'completa' ? 'Contraer detalle' : 'Expandir detalle'}
          aria-expanded={posicion !== 'asomada'}
          onClick={alPulsar}
          onPointerDown={alBajar}
          onPointerUp={alSoltar}
          className="flex h-11 w-full flex-none touch-none items-start justify-center pt-2"
        >
          <span className="h-1 w-10 rounded-[2px] bg-borde-2" />
        </button>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
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
