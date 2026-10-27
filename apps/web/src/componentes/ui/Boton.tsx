import type { ButtonHTMLAttributes } from 'react';
import { Icono, type NombreIcono } from './Icono';

// Flat (D-028): colores sólidos y bordes de 1 px, sin sombras ni degradados. Todo mide 44 px o más.

const VARIANTE = {
  primario: 'h-12 rounded-boton bg-acento px-5 text-base text-sobre-acento',
  // La acción principal de una pantalla (el aviso de Reportar, D-038): 60 px y fuente de títulos.
  grande:
    'h-15 rounded-tarjeta bg-acento px-5 font-display text-lg font-extrabold text-sobre-acento',
  secundario:
    'h-11 rounded-control border border-borde-control bg-superficie px-4 text-sm text-texto',
  peligro:
    'h-11 rounded-control border border-estado-sin-servicio-trazo bg-superficie px-4 text-sm text-estado-sin-servicio-tinta',
  texto: 'h-11 rounded-control px-3 text-sm text-acento',
} as const;

export type VarianteBoton = keyof typeof VARIANTE;

export function Boton({
  variante = 'primario',
  icono,
  ancho = false,
  cargando = false,
  className = '',
  children,
  disabled,
  type = 'button',
  ...resto
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: VarianteBoton;
  icono?: NombreIcono;
  /** Ocupa todo el ancho del contenedor. */
  ancho?: boolean;
  cargando?: boolean;
}) {
  return (
    <button
      type={type}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      className={`inline-flex min-w-11 items-center justify-center gap-2 font-semibold whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-55 ${VARIANTE[variante]} ${ancho ? 'w-full' : ''} ${className}`}
      {...resto}
    >
      {icono && <Icono nombre={icono} tamano={18} />}
      {cargando ? 'Un momento…' : children}
    </button>
  );
}
