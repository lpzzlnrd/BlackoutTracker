import { Icono, type NombreIcono } from '../componentes/ui/Icono';

/**
 * Qué pasa con un aviso (D-038): se guarda en la cola aunque no haya red (OFF-01), se envía solo
 * al volver la conexión (OFF-04) y el sector cambia cuando lo confirman N vecinos (CON-01,
 * CON-06). Responde a "¿y ahora qué?" antes de que el vecino se lo pregunte.
 */
export function DespuesDeAvisar({ consensoN }: { consensoN: number }) {
  const pasos: readonly { icono: NombreIcono; texto: string }[] = [
    { icono: 'smartphone', texto: 'Se guarda en tu teléfono, aunque no tengas señal.' },
    { icono: 'send', texto: 'Se envía automáticamente cuando vuelve la conexión.' },
    {
      icono: 'users',
      texto: `Cuando ${consensoN} vecinos lo confirman, tu sector cambia en el mapa.`,
    },
  ];
  return (
    <section aria-labelledby="titulo-despues">
      <h2
        id="titulo-despues"
        className="text-xs font-extrabold tracking-[.06em] text-secundario uppercase"
      >
        Después de avisar
      </h2>
      <ol className="mt-2.5 flex flex-col gap-2">
        {pasos.map(({ icono, texto }) => (
          <li key={icono} className="flex items-center gap-3 text-sm leading-[1.35]">
            <span
              aria-hidden="true"
              className="grid h-8 w-8 flex-none place-items-center rounded-control bg-superficie-2 text-texto-2"
            >
              <Icono nombre={icono} tamano={16} grosor={2.2} />
            </span>
            {texto}
          </li>
        ))}
      </ol>
    </section>
  );
}
