import type { ReactNode } from 'react';
import { Icono } from '../componentes/ui/Icono';

// Piezas de la guía y del recorrido (D-041, D-043).

/** Una muestra con datos inventados: el rótulo evita que se lea como el estado real. */
export function Ejemplo({ children }: { children: ReactNode }) {
  return (
    <figure className="flex flex-col gap-2.5 rounded-bloque bg-superficie-2 p-3">
      <figcaption className="text-xs font-semibold text-secundario">Ejemplo</figcaption>
      {children}
    </figure>
  );
}

/** El sector como en el mapa: un hexágono (D-040) con la casa, nunca un punto (CANON §1.3). */
export function Hexagono() {
  return (
    <span aria-hidden="true" className="relative grid h-11 w-11 flex-none place-items-center">
      <svg width="44" height="44" viewBox="0 0 44 44" className="absolute inset-0">
        <polygon
          points="22,3 39,12.5 39,31.5 22,41 5,31.5 5,12.5"
          className="fill-superficie stroke-texto"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      </svg>
      <Icono nombre="home" tamano={18} grosor={2.4} className="relative" />
    </span>
  );
}
