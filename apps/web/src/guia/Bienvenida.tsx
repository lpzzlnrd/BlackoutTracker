import { useEffect, useRef } from 'react';
import { mostrarBienvenida } from '../aplicacion/bienvenida';
import { Boton } from '../componentes/ui/Boton';
import { Marca } from '../componentes/ui/Icono';
import { useSesion } from '../datos/consultas';
import { useObservable } from '../datos/contexto';
import { navegar, useRuta, type Ruta } from '../navegacion/ruta';
import { recorrido, recuerdoBienvenida } from './recuerdo';
import { empezarRecorrido } from './recorrido/empezar';

/**
 * "¿Nuevo en BlackoutTracker?" (T-071, D-041): la primera vez que alguien entra sin sesión, en
 * cualquier pantalla. "Empezar" abre el recorrido guiado (T-073, D-043). Cualquier salida lo deja
 * visto en este dispositivo; el recorrido se repite desde Cuenta.
 */
export function Bienvenida() {
  const hayUsuario = useSesion() !== null;
  const vista = useObservable(recuerdoBienvenida.vista);
  const enRecorrido = useObservable(recorrido.estado) !== null;
  const ruta = useRuta();
  if (enRecorrido || !mostrarBienvenida({ hayUsuario, vista, ruta })) return null;
  return <DialogoBienvenida ruta={ruta} />;
}

/**
 * Un `<dialog>` nativo abierto con `showModal()`: atrapa el foco, deja inerte el resto de la
 * página y va en la capa superior, por encima del mapa (Leaflet llega a z-index 1000). Al cerrarse
 * se desmonta; por eso el efecto no lo cierra (en StrictMode lo cerraría y marcaría como visto).
 */
function DialogoBienvenida({ ruta }: { ruta: Ruta }) {
  const dialogo = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const elemento = dialogo.current;
    if (!elemento || elemento.open) return;
    elemento.showModal();
    // El foco va a la acción principal: React no pone el atributo `autofocus` en el HTML.
    elemento.querySelector<HTMLButtonElement>('[data-principal]')?.focus();
  }, []);

  const empezar = () => {
    recuerdoBienvenida.marcar();
    empezarRecorrido({ hayUsuario: false, tienePerfil: false }, ruta);
  };
  const tengoCuenta = () => {
    recuerdoBienvenida.marcar();
    navegar('/entrar');
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
        Aquí los vecinos avisan cuando se va la luz o el agua. Te guiamos en la app misma: creas tu
        cuenta, marcas tu casa y aprendes a avisar. Son 7 pasos cortos.
      </p>
      <div className="mt-5 flex flex-col gap-1">
        <Boton data-principal ancho onClick={empezar}>
          Empezar
        </Boton>
        <Boton variante="secundario" ancho onClick={tengoCuenta}>
          Ya tengo cuenta
        </Boton>
        <Boton variante="texto" ancho onClick={() => recuerdoBienvenida.marcar()}>
          Ahora no
        </Boton>
      </div>
      <p className="mt-1 text-center text-xs text-secundario">
        Puedes repetirlo cuando quieras en Cuenta.
      </p>
    </dialog>
  );
}
