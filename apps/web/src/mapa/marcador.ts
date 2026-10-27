import type { EstadoVisual } from '../dominio/tipos';

// HTML de la etiqueta de cada sector en el mapa (CANON §4.3 y §4.4, con el estilo de D-038): la
// etiqueta "Tu sector" (solo el propio) y una píldora con la insignia del estado y el nombre. Va en
// un `L.divIcon`, así que es una cadena; los colores salen de los tokens, nunca en hex.

const GLIFO: Record<EstadoVisual, string> = {
  'con-servicio': '<polyline points="6 12.5 10.5 17 18 8"/>',
  'sin-servicio': '<line x1="7" y1="7" x2="17" y2="17"/><line x1="17" y1="7" x2="7" y2="17"/>',
  'sin-confirmar':
    '<path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  'sin-datos': '<line x1="7" y1="12" x2="17" y2="12"/>',
};

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** El nombre del sector viene de la API: se escapa antes de meterlo en HTML. */
export const escaparHtml = (texto: string): string =>
  texto.replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c);

/** Ancho de la caja del marcador; la píldora se centra en ella. */
export const ANCHO_MARCADOR = 200;
/** Alto de la píldora del nombre (`.marcador-pildora`). */
export const ALTO_NOMBRE = 30;
const ALTO_PROPIO = 20;
const ALTO_INSIGNIA = 24;
const SEPARACION = 4;
/** Lo que la píldora suma al texto: relleno (5 + 12), insignia (20) y separación (6). */
const EXTRA_PILDORA = 43;

/** Tamaño del nombre en px: el mismo de `.marcador-pildora` en pantalla-mapa.css. */
export const TAMANO_NOMBRE = { telefono: 14, escritorio: 16 } as const;

let contexto: CanvasRenderingContext2D | null | undefined;

/**
 * Ancho del texto en negrita con la fuente de títulos, medido en un canvas. Sin `document`
 * (los tests corren en Node), se estima en 0,6 em por carácter.
 */
function anchoTexto(texto: string, tamano: number): number {
  contexto ??=
    typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  if (!contexto) return texto.length * tamano * 0.6;
  const fuente = getComputedStyle(document.documentElement)
    .getPropertyValue('--fuente-display')
    .trim();
  contexto.font = `700 ${tamano}px ${fuente || 'sans-serif'}`;
  return contexto.measureText(texto).width;
}

/**
 * Ancho en pantalla de la píldora con el nombre de un sector, para decidir si cabe dentro del
 * sector o va solo la insignia.
 */
export const anchoNombre = (nombre: string, tamano: number): number =>
  Math.ceil(anchoTexto(nombre, tamano)) + EXTRA_PILDORA;

export interface Marcador {
  html: string;
  tamano: [number, number];
  /** Punto del marcador que cae sobre la posición: el centro de la píldora. */
  ancla: [number, number];
}

export function marcadorSector(opciones: {
  nombre: string;
  estado: EstadoVisual;
  propio: boolean;
  /** Sector demasiado pequeño en pantalla para su nombre: solo la insignia. */
  compacto?: boolean;
}): Marcador {
  const { nombre, estado, propio, compacto = false } = opciones;
  const insignia =
    `<span class="marcador-insignia marcador-insignia--${estado}">` +
    `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${GLIFO[estado]}</svg>` +
    `</span>`;
  if (compacto) {
    return {
      html: `<div class="marcador-sector marcador-sector--compacto">${insignia}</div>`,
      tamano: [ALTO_INSIGNIA, ALTO_INSIGNIA],
      ancla: [ALTO_INSIGNIA / 2, ALTO_INSIGNIA / 2],
    };
  }
  const etiqueta = propio ? '<span class="marcador-propio">Tu sector</span>' : '';
  const html =
    `<div class="marcador-sector">${etiqueta}` +
    `<span class="marcador-pildora">${insignia}<span>${escaparHtml(nombre)}</span></span></div>`;
  const arriba = propio ? ALTO_PROPIO + SEPARACION : 0;
  return {
    html,
    tamano: [ANCHO_MARCADOR, arriba + ALTO_NOMBRE],
    ancla: [ANCHO_MARCADOR / 2, arriba + ALTO_NOMBRE / 2],
  };
}
