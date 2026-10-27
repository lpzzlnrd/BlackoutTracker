import type { ReactNode } from 'react';
import { Icono, type NombreIcono } from './Icono';

const TONO: Record<'error' | 'info' | 'aviso', { clase: string; icono: NombreIcono }> = {
  error: {
    clase:
      'border-estado-sin-servicio-trazo bg-estado-sin-servicio-chip text-estado-sin-servicio-tinta',
    icono: 'alert-triangle',
  },
  aviso: {
    clase:
      'border-estado-sin-confirmar-trazo bg-estado-sin-confirmar-chip text-estado-sin-confirmar-tinta',
    icono: 'clock',
  },
  info: { clase: 'border-borde bg-superficie-2 text-texto-2', icono: 'help-circle' },
};

/** Mensaje en línea (errores de formularios, avisos). Los errores se anuncian (`role="alert"`). */
export function Mensaje({
  tono = 'info',
  children,
}: {
  tono?: 'error' | 'info' | 'aviso';
  children: ReactNode;
}) {
  const { clase, icono } = TONO[tono];
  return (
    <div
      role={tono === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-2.5 rounded-bloque border px-3 py-2.5 text-sm leading-[1.35] ${clase}`}
    >
      <Icono nombre={icono} tamano={18} grosor={2.2} className="mt-px" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Bloque gris del tamaño del contenido mientras carga (A §5). Sin animación con menos movimiento. */
export function Esqueleto({ className = 'h-6' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-bloque bg-superficie-2 motion-reduce:animate-none ${className}`}
    />
  );
}
