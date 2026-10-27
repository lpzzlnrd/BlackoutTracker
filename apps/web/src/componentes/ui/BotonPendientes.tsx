import { Icono } from './Icono';

const etiquetaAccesible = (n: number) =>
  `${n} ${n === 1 ? 'aviso pendiente' : 'avisos pendientes'} de envío`;

/**
 * Botón de la cola (A §3): "1 pendiente" con el reloj. Por debajo de 360 px queda solo el reloj
 * con una insignia (CANON §2). Sin pendientes no se muestra.
 */
export function BotonPendientes({ cantidad, onClick }: { cantidad: number; onClick: () => void }) {
  if (cantidad === 0) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiquetaAccesible(cantidad)}
      className="relative inline-flex h-11 min-w-11 flex-none items-center justify-center gap-1.5 rounded-chip border border-estado-sin-confirmar-trazo bg-estado-sin-confirmar-chip px-3.5 text-sm font-semibold text-estado-sin-confirmar-tinta"
    >
      <Icono nombre="clock" tamano={16} grosor={2.2} />
      <span className="hidden min-[360px]:inline">
        {cantidad} {cantidad === 1 ? 'pendiente' : 'pendientes'}
      </span>
      <span className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-chip bg-estado-sin-confirmar-tinta px-1 text-xs font-bold text-estado-sin-confirmar-chip min-[360px]:hidden">
        {cantidad}
      </span>
    </button>
  );
}
