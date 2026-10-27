import { ETIQUETA_ESTADO } from '../../dominio/estado-visual';
import type { EstadoAviso, EstadoVisual } from '../../dominio/tipos';
import { Icono, type NombreIcono } from './Icono';

// Chips de CANON §3: color + icono + texto, nunca solo color. Las clases van completas (no se
// arman por partes) para que Tailwind las encuentre.

const COLOR_ESTADO: Record<EstadoVisual, string> = {
  'con-servicio': 'bg-estado-con-servicio-chip text-estado-con-servicio-tinta',
  'sin-confirmar': 'bg-estado-sin-confirmar-chip text-estado-sin-confirmar-tinta',
  'sin-servicio': 'bg-estado-sin-servicio-chip text-estado-sin-servicio-tinta',
  'sin-datos': 'bg-estado-sin-datos-chip text-estado-sin-datos-tinta',
};

const ICONO_COMPLETO: Record<EstadoVisual, NombreIcono> = {
  'con-servicio': 'check-circle',
  'sin-confirmar': 'help-circle',
  'sin-servicio': 'x-circle',
  'sin-datos': 'minus-circle',
};

const ICONO_COMPACTO: Record<EstadoVisual, NombreIcono> = {
  'con-servicio': 'check',
  'sin-confirmar': 'interrogacion',
  'sin-servicio': 'x',
  'sin-datos': 'minus-circle',
};

/** Texto largo de las leyendas con espacio (CANON §3). */
export const ETIQUETA_LARGA: Record<EstadoVisual, string> = {
  ...ETIQUETA_ESTADO,
  'sin-confirmar': 'Reportes sin confirmar',
};

/**
 * Chip de estado. `completo`: icono con círculo (cabeceras, detalle). `compacto`: glifo suelto
 * (leyendas, tablas).
 */
export function EstadoChip({
  estado,
  variante = 'completo',
  texto = 'corto',
}: {
  estado: EstadoVisual;
  variante?: 'completo' | 'compacto';
  texto?: 'corto' | 'largo';
}) {
  const etiqueta = texto === 'largo' ? ETIQUETA_LARGA[estado] : ETIQUETA_ESTADO[estado];
  return variante === 'completo' ? (
    <span
      className={`inline-flex items-center gap-1.5 rounded-chip px-2.5 py-1 text-[13px] font-semibold whitespace-nowrap ${COLOR_ESTADO[estado]}`}
    >
      <Icono nombre={ICONO_COMPLETO[estado]} tamano={16} />
      {etiqueta}
    </span>
  ) : (
    <span
      className={`inline-flex h-7 items-center gap-[5px] rounded-chip px-2.5 text-xs font-semibold whitespace-nowrap ${COLOR_ESTADO[estado]}`}
    >
      <Icono nombre={ICONO_COMPACTO[estado]} tamano={13} grosor={2.6} />
      {etiqueta}
    </span>
  );
}

const CUADRO: Record<EstadoVisual, string> = {
  'sin-servicio': 'bg-estado-sin-servicio-relleno text-sobre-estado',
  'sin-confirmar': 'bg-estado-sin-confirmar-chip text-estado-sin-confirmar-tinta',
  'con-servicio': 'bg-estado-con-servicio-chip text-estado-con-servicio-tinta',
  'sin-datos': 'bg-estado-sin-datos-chip text-estado-sin-datos-tinta',
};

/**
 * Cuadro de 44 px con el glifo del estado, al inicio de las tarjetas del panel (D-038): sólido
 * solo si está sin servicio. Es decorativo: el texto del estado va siempre a su lado.
 */
export function CuadroEstado({ estado }: { estado: EstadoVisual }) {
  return (
    <span
      aria-hidden="true"
      className={`grid h-11 w-11 flex-none place-items-center rounded-bloque ${CUADRO[estado]}`}
    >
      <Icono nombre={ICONO_COMPACTO[estado]} tamano={22} grosor={2.8} />
    </span>
  );
}

const SYNC: Record<EstadoAviso, { texto: string; icono: NombreIcono; color: string }> = {
  pendiente: {
    texto: 'Pendiente',
    icono: 'clock',
    color: 'bg-estado-sin-confirmar-chip text-estado-sin-confirmar-tinta',
  },
  enviado: { texto: 'Enviado', icono: 'check', color: 'bg-superficie-2 text-texto-2' },
  error: {
    texto: 'Error',
    icono: 'alert-triangle',
    color: 'bg-estado-sin-servicio-chip text-estado-sin-servicio-tinta',
  },
};

/** Chip de sincronización de un aviso de la cola: Pendiente / Enviado / Error. */
export function ChipSync({ estado }: { estado: EstadoAviso }) {
  const { texto, icono, color } = SYNC[estado];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-chip px-2.5 py-1 text-[13px] font-semibold whitespace-nowrap ${color}`}
    >
      <Icono nombre={icono} tamano={14} grosor={2.2} />
      {texto}
    </span>
  );
}
