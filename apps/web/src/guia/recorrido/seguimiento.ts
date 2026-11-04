import { useEffect, useRef, useState, type RefObject } from 'react';

// Dónde está, cuadro a cuadro, lo que señala el recorrido (D-043). Se mide con
// `requestAnimationFrame` y no con observadores: así sigue al elemento cuando la página hace
// scroll, la hoja del mapa se abre o el teléfono gira, sin engancharse a cada componente.

export interface Caja {
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

export interface Pantalla {
  ancho: number;
  alto: number;
}

/** El primer elemento visible con ese `data-guia` (el teléfono y el escritorio tienen el suyo). */
export function buscarGuia(nombre: string): HTMLElement | null {
  for (const elemento of document.querySelectorAll<HTMLElement>(`[data-guia="${nombre}"]`)) {
    if (elemento.getClientRects().length > 0) return elemento;
  }
  return null;
}

/** A la vista y sin desactivar: el botón "Continuar" del registro no vale hasta tener el pin. */
const activo = (elemento: HTMLElement | null): boolean =>
  elemento !== null &&
  !(elemento instanceof HTMLButtonElement && elemento.disabled) &&
  elemento.getAttribute('aria-disabled') !== 'true';

/**
 * La caja del elemento, recortada a la pantalla y al área de contenido: lo que queda debajo de la
 * navegación no se ilumina, para que el hueco no deje tocarla.
 */
function medir(elemento: HTMLElement): Caja {
  const r = elemento.getBoundingClientRect();
  const area = elemento.closest('#contenido')?.getBoundingClientRect();
  const izquierda = Math.max(r.left, area?.left ?? 0, 0);
  const arriba = Math.max(r.top, area?.top ?? 0, 0);
  const derecha = Math.min(r.right, area?.right ?? Infinity, window.innerWidth);
  const abajo = Math.min(r.bottom, area?.bottom ?? Infinity, window.innerHeight);
  return {
    x: izquierda,
    y: arriba,
    ancho: Math.max(0, derecha - izquierda),
    alto: Math.max(0, abajo - arriba),
  };
}

const claveCaja = (caja: Caja | null) =>
  caja
    ? `${Math.round(caja.x)},${Math.round(caja.y)},${Math.round(caja.ancho)},${Math.round(caja.alto)}`
    : '';

const pantallaActual = (): Pantalla => ({ ancho: window.innerWidth, alto: window.innerHeight });

/** Repite `medir` en cada cuadro mientras el componente esté montado. */
function useCadaCuadro(medir: () => void, deps: readonly unknown[]) {
  const ultima = useRef(medir);
  useEffect(() => {
    ultima.current = medir;
  });
  useEffect(() => {
    let cuadro = 0;
    const paso = () => {
      ultima.current();
      cuadro = requestAnimationFrame(paso);
    };
    paso();
    return () => cancelAnimationFrame(cuadro);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- las dependencias las da quien llama
  }, deps);
}

export interface Seguimiento {
  /** La zona iluminada; `null` si el objetivo no está en pantalla. */
  hueco: Caja | null;
  /** Lo señalado con el anillo. */
  anillo: Caja | null;
  pantalla: Pantalla;
  /** El elemento del objetivo, para saber si un toque o una tecla cayó dentro. */
  elemento: RefObject<HTMLElement | null>;
}

/**
 * Sigue el objetivo y el foco de la indicación en curso. La primera vez que aparece el foco lo
 * lleva al centro de la pantalla y llama a `alEncontrar` (para enfocar el campo, por ejemplo).
 */
export function useSeguimiento({
  objetivo,
  foco,
  alEncontrar,
}: {
  objetivo: string | undefined;
  foco: string | undefined;
  alEncontrar?: (objetivo: HTMLElement) => void;
}): Seguimiento {
  const elemento = useRef<HTMLElement | null>(null);
  const encontrado = useRef(false);
  const anterior = useRef('');
  const [medida, setMedida] = useState<Omit<Seguimiento, 'elemento'>>(() => ({
    hueco: null,
    anillo: null,
    pantalla: pantallaActual(),
  }));

  useEffect(() => {
    encontrado.current = false;
  }, [objetivo, foco]);

  useCadaCuadro(() => {
    const delObjetivo = objetivo ? buscarGuia(objetivo) : null;
    const delFoco = foco ? buscarGuia(foco) : delObjetivo;
    elemento.current = delObjetivo;

    if (delObjetivo && delFoco && !encontrado.current) {
      encontrado.current = true;
      delFoco.scrollIntoView({ block: 'center', inline: 'nearest' });
      alEncontrar?.(delObjetivo);
    }

    const hueco = delObjetivo ? medir(delObjetivo) : null;
    const anillo = delFoco ? medir(delFoco) : null;
    const pantalla = pantallaActual();
    const clave = `${claveCaja(hueco)}|${claveCaja(anillo)}|${pantalla.ancho}x${pantalla.alto}`;
    if (clave !== anterior.current) {
      anterior.current = clave;
      setMedida({ hueco, anillo, pantalla });
    }
  }, [objetivo, foco]);

  return { ...medida, elemento };
}

/**
 * Para los pasos que siguen a la pantalla (la vivienda): el índice de la última de estas guías que
 * está a la vista y activa, o -1 si ninguna.
 */
export function useUltimaVisible(nombres: readonly (string | undefined)[]): number {
  const [ultima, setUltima] = useState(-1);
  const clave = nombres.join('|');
  useCadaCuadro(() => {
    let encontrada = -1;
    nombres.forEach((nombre, i) => {
      if (nombre && activo(buscarGuia(nombre))) encontrada = i;
    });
    setUltima(encontrada);
  }, [clave]);
  return ultima;
}
