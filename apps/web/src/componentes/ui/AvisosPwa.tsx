import { useState } from 'react';
import { useObservable } from '../../datos/contexto';
import { usePwa } from '../../pwa/contexto';
import { aplicarTema, leerTema, type Tema } from '../../pwa/tema';
import { Icono } from './Icono';

const NUNCA = { leer: () => false, suscribir: () => () => undefined };

/** Tarjeta "Instalar BlackoutTracker" (A §4). Solo si el navegador lo permite y no se descartó. */
export function AvisoInstalacion() {
  const { instalacion } = usePwa();
  const disponible = useObservable(instalacion.disponible);
  if (!disponible) return null;
  return (
    <section
      aria-labelledby="titulo-instalar"
      className="flex flex-col gap-2.5 rounded-tarjeta border border-borde bg-superficie-2 p-3.5"
    >
      <h2 id="titulo-instalar" className="text-sm font-bold">
        Instalar BlackoutTracker
      </h2>
      <p className="text-[13px] leading-[1.4] text-secundario">
        Se abre como una app y sigue funcionando sin conexión.
      </p>
      <button
        type="button"
        onClick={() => void instalacion.instalar()}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-control border border-borde-control bg-superficie text-sm font-semibold text-texto"
      >
        <Icono nombre="download" tamano={16} />
        Instalar
      </button>
      <button
        type="button"
        onClick={() => instalacion.descartar()}
        className="h-11 text-[13px] font-semibold text-secundario"
      >
        Ahora no
      </button>
    </section>
  );
}

/**
 * "Hay una versión nueva de la app · Actualizar" (CANON §7.2). Las versiones se ofrecen, no se
 * imponen: un vecino a mitad de un reporte no pierde lo que escribe.
 */
export function AvisoVersion() {
  const { sw } = usePwa();
  const hayVersion = useObservable(sw?.versionNueva ?? NUNCA);
  if (!sw || !hayVersion) return null;
  return (
    <div
      role="status"
      className="fixed right-4 bottom-[104px] left-4 z-[1100] flex items-center justify-between gap-3 rounded-bloque bg-inverso-fondo px-4 py-2.5 text-sm text-inverso-texto lg:bottom-6 lg:left-auto lg:w-[360px]"
    >
      <span>Hay una versión nueva de la app</span>
      <button
        type="button"
        onClick={() => void sw.actualizar()}
        className="h-11 flex-none rounded-control bg-inverso-acento px-4 font-semibold text-inverso-sobre-acento"
      >
        Actualizar
      </button>
    </div>
  );
}

const TEMAS: readonly { valor: Tema; texto: string }[] = [
  { valor: 'sistema', texto: 'Sistema' },
  { valor: 'claro', texto: 'Claro' },
  { valor: 'oscuro', texto: 'Oscuro' },
];

/** "Tema: Sistema · Claro · Oscuro" (PWA.md §6). De noche, durante un apagón, el oscuro ayuda. */
export function SelectorTema() {
  const [tema, fijar] = useState(leerTema);
  const elegir = (nuevo: Tema) => {
    aplicarTema(nuevo);
    fijar(nuevo);
  };
  return (
    <div className="flex flex-col gap-1.5">
      <span id="etiqueta-tema" className="text-sm font-semibold">
        Tema
      </span>
      <div
        role="group"
        aria-labelledby="etiqueta-tema"
        className="inline-flex w-fit gap-1 rounded-tarjeta border border-borde bg-superficie p-1"
      >
        {TEMAS.map(({ valor, texto }) => (
          <button
            key={valor}
            type="button"
            aria-pressed={tema === valor}
            onClick={() => elegir(valor)}
            className={`h-11 min-w-[88px] rounded-control px-3 text-[15px] font-semibold ${
              tema === valor ? 'bg-acento text-sobre-acento' : 'text-texto-2'
            }`}
          >
            {texto}
          </button>
        ))}
      </div>
    </div>
  );
}
