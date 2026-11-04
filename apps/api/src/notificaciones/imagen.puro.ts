// La imagen de la notificación (T-072, D-042, idea b): tu hexágono al centro y sus 6 vecinos H3,
// cada uno con el estado del servicio. Responde de un vistazo «¿es solo aquí o es toda la zona?».
// Lógica pura: recibe las celdas y sus estados y devuelve un SVG; el servicio lo pasa a PNG.
//
// Solo dibuja hexágonos (NF-06: nunca personas ni pines) y sin texto, para no depender de fuentes
// en el servidor. Colores del canon del frontend (§3), en claro: la imagen la pinta el sistema.
import { cellToBoundary } from 'h3-js';
import type { TipoServicio } from '@blackout/shared';

export const ANCHO_IMAGEN = 720;
export const ALTO_IMAGEN = 360;
const MARGEN = 28;

/** Los cuatro estados del mapa (canon §3). `sin-datos`: nadie se ha registrado en esa celda. */
export type EstadoCelda = 'con-servicio' | 'sin-confirmar' | 'sin-servicio' | 'sin-datos';

export interface CeldaImagen {
  celda: string;
  estado: EstadoCelda;
  /** El sector del vecino: va con trazo de tinta y el icono del servicio. */
  propio: boolean;
}

const ESTILO: Record<EstadoCelda, string> = {
  'con-servicio': 'fill="#5b9bd5" fill-opacity="0.6" stroke="#235c94"',
  'sin-confirmar': 'fill="url(#trama)" stroke="#946200"',
  'sin-servicio': 'fill="#c0391a" fill-opacity="0.78" stroke="#8f2a12"',
  'sin-datos': 'fill="#9ca3af" fill-opacity="0.38" stroke="#6f7782" stroke-dasharray="6 5"',
};

/** Rayo (luz) y gota (agua), en una caja de 24 × 24 centrada en el origen. */
const ICONO: Record<TipoServicio, string> = {
  electricidad: 'M1.5 -11 L-7 1.5 H-0.5 L-2 11 L7 -2 H0.5 Z',
  agua: 'M0 -11 C4 -5 8 -1 8 3.5 A8 8 0 0 1 -8 3.5 C-8 -1 -4 -5 0 -11 Z',
};

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * El SVG del vecindario. Las celdas se proyectan en equirectangular (a esta escala, unos 3 km, la
 * distorsión no se nota) y se encajan en la imagen manteniendo la proporción.
 */
export function svgVecindario(celdas: readonly CeldaImagen[], servicio: TipoServicio): string {
  const contornos = celdas.map((c) => ({ ...c, puntos: cellToBoundary(c.celda) }));
  const todos = contornos.flatMap((c) => c.puntos);
  const lat0 = todos.reduce((s, [lat]) => s + lat, 0) / todos.length;
  const kx = Math.cos((lat0 * Math.PI) / 180);
  const xs = todos.map(([, lng]) => lng * kx);
  const ys = todos.map(([lat]) => -lat);
  const [minX, maxX, minY, maxY] = [
    Math.min(...xs),
    Math.max(...xs),
    Math.min(...ys),
    Math.max(...ys),
  ];
  const escala = Math.min(
    (ANCHO_IMAGEN - 2 * MARGEN) / (maxX - minX),
    (ALTO_IMAGEN - 2 * MARGEN) / (maxY - minY),
  );
  const dx = (ANCHO_IMAGEN - (maxX - minX) * escala) / 2;
  const dy = (ALTO_IMAGEN - (maxY - minY) * escala) / 2;
  const px = ([lat, lng]: number[]) =>
    [r1((lng * kx - minX) * escala + dx), r1((-lat - minY) * escala + dy)] as const;

  // El propio va al final, para que su trazo grueso quede encima de los vecinos.
  const orden = [...contornos].sort((a, b) => Number(a.propio) - Number(b.propio));
  const hexagonos = orden.map((c) => {
    const puntos = c.puntos.map((p) => px(p).join(',')).join(' ');
    const trazo = c.propio ? 'stroke="#16181d" stroke-width="7"' : 'stroke-width="3"';
    const estilo = c.propio ? ESTILO[c.estado].replace(/stroke="[^"]*"/, '') : ESTILO[c.estado];
    return `<polygon points="${puntos}" ${estilo} ${trazo} stroke-linejoin="round"/>`;
  });

  const propio = contornos.find((c) => c.propio);
  let icono = '';
  if (propio) {
    const centro = propio.puntos.map(px);
    const cx = r1(centro.reduce((s, [x]) => s + x, 0) / centro.length);
    const cy = r1(centro.reduce((s, [, y]) => s + y, 0) / centro.length);
    const radio = Math.min(...centro.map(([x, y]) => Math.hypot(x - cx, y - cy)));
    const k = r1((radio * 0.62) / 12);
    icono =
      `<circle cx="${cx}" cy="${cy}" r="${r1(radio * 0.6)}" fill="#ffffff" fill-opacity="0.92"/>` +
      `<path d="${ICONO[servicio]}" transform="translate(${cx} ${cy}) scale(${k})" fill="#16181d"/>`;
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${ANCHO_IMAGEN}" height="${ALTO_IMAGEN}" viewBox="0 0 ${ANCHO_IMAGEN} ${ALTO_IMAGEN}">` +
    '<defs><pattern id="trama" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
    '<rect width="9" height="9" fill="#f5c84c" fill-opacity="0.6"/>' +
    '<line x1="0" y1="0" x2="0" y2="9" stroke="#946200" stroke-width="3"/></pattern></defs>' +
    `<rect width="${ANCHO_IMAGEN}" height="${ALTO_IMAGEN}" fill="#f4f2ec"/>` +
    hexagonos.join('') +
    icono +
    '</svg>'
  );
}
