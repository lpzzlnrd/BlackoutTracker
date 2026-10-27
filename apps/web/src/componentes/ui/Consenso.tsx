// Barritas del consenso (D-038).

/**
 * El consenso a la vista (CON-01): una barrita por vecino que hace falta, llenas las que ya
 * reportaron. Toma el color del texto del bloque. El texto dice lo mismo para el lector.
 */
export function Consenso({
  llenas,
  total,
  texto,
}: {
  llenas: number;
  total: number;
  texto: string;
}) {
  return (
    <p className="flex items-center gap-2 text-[13px] font-semibold">
      <span aria-hidden="true" className="flex flex-none gap-[3px]">
        {Array.from({ length: Math.min(total, 10) }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 w-[18px] rounded-[3px] bg-current ${i < llenas ? '' : 'opacity-30'}`}
          />
        ))}
      </span>
      {texto}
    </p>
  );
}
