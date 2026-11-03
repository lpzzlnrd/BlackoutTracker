import { useEffect, useRef } from 'react';
import { mostrarBienvenida } from '../aplicacion/bienvenida';
import { Boton } from '../componentes/ui/Boton';
import { Marca } from '../componentes/ui/Icono';
import { useSesion } from '../datos/consultas';
import { useObservable } from '../datos/contexto';
import { navegar, useRuta } from '../navegacion/ruta';
import { recuerdoBienvenida } from './recuerdo';

/**
 * "¿Nuevo en BlackoutTracker?" (T-071, D-041): la primera vez que alguien entra sin sesión, en
 * cualquier pantalla. Cualquier salida (la guía, "Ahora no" o Escape) lo deja visto en este
 * dispositivo; la guía sigue a mano en Cuenta.
 */
export function Bienvenida() {
  const hayUsuario = useSesion() !== null;
  const vista = useObservable(recuerdoBienvenida.vista);
  const ruta = useRuta();
  if (!mostrarBienvenida({ hayUsuario, vista, ruta })) return null;
  return <DialogoBienvenida />;
}

/**
 * Un `<dialog>` nativo abierto con `showModal()`: atrapa el foco, deja inerte el resto de la
 * página y va en la capa superior, por encima del mapa (Leaflet llega a z-index 1000). Al cerrarse
 * se desmonta; por eso el efecto no lo cierra (en StrictMode lo cerraría y marcaría como visto).
 */
function DialogoBienvenida() {
  const dialogo = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const elemento = dialogo.current;
    if (!elemento || elemento.open) return;
    elemento.showModal();
    // El foco va a la acción principal: React no pone el atributo `autofocus` en el HTML.
    elemento.querySelector<HTMLButtonElement>('[data-principal]')?.focus();
  }, []);

  const verGuia = () => {
    recuerdoBienvenida.marcar();
    navegar('/guia');
  };

  return (
    <dialog
      ref={dialogo}
      aria-labelledby="titulo-bienvenida"
      aria-describedby="texto-bienvenida"
      // Escape es "Ahora no". El cierre nativo se cancela para que lo decida el recuerdo, y `onClose`
      // cubre el caso en que el navegador lo cierra sin preguntar (dos Escape seguidos).
      onCancel={(evento) => {
        evento.preventDefault();
        recuerdoBienvenida.marcar();
      }}
      onClose={() => recuerdoBienvenida.marcar()}
      className="bienvenida m-auto w-[calc(100%-32px)] max-w-[400px] rounded-tarjeta border border-borde bg-superficie p-5 text-texto lg:p-6"
    >
      <Marca tamano={40} />
      <h2
        id="titulo-bienvenida"
        className="mt-4 font-display text-[26px] leading-[1.1] font-extrabold tracking-[-0.01em]"
      >
        ¿Nuevo en BlackoutTracker?
      </h2>
      <p id="texto-bienvenida" className="mt-2 text-[15px] leading-[1.45] text-texto-2">
        Te mostramos el paso a paso: cómo leer el mapa, crear tu cuenta y avisar cuando se va la luz
        o el agua en tu sector.
      </p>
      <div className="mt-5 flex flex-col gap-1">
        <Boton data-principal ancho onClick={verGuia}>
          Ver la guía
        </Boton>
        <Boton variante="texto" ancho onClick={() => recuerdoBienvenida.marcar()}>
          Ahora no
        </Boton>
      </div>
      <p className="mt-1 text-center text-xs text-secundario">
        Puedes verla cuando quieras en Cuenta.
      </p>
    </dialog>
  );
}
