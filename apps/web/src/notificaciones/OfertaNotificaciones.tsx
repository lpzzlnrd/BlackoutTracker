import { useState } from 'react';
import {
  debeOfrecerNotificaciones,
  guardarDescarteOferta,
  leerDescarteOferta,
} from '../aplicacion/notificaciones';
import { Boton } from '../componentes/ui/Boton';
import { Icono } from '../componentes/ui/Icono';
import { Mensaje } from '../componentes/ui/Mensaje';
import { useClavePush } from '../datos/consultas';
import { usePuertos } from '../datos/contexto';
import { almacenLocal } from './almacen';
import { textoResultadoActivar } from './textos';
import { useActivarNotificaciones } from './useActivarNotificaciones';

/**
 * "¿Te avisamos cuando tus vecinos lo confirmen?" (D-042). Sale justo después de guardar un
 * reporte, que es cuando el vecino entiende para qué sirve: nunca al abrir la app. Si dice "Ahora
 * no", no vuelve a salir en una semana.
 */
export function OfertaNotificaciones() {
  const { push, reloj } = usePuertos();
  const clave = useClavePush();
  const { activar, ocupado, resultado, error } = useActivarNotificaciones();
  const [descartada, setDescartada] = useState(false);
  // Se decide una vez: al aceptar, el permiso deja de estar pendiente y la tarjeta muestra el
  // resultado en vez de desaparecer.
  const [ofrecer] = useState(() =>
    debeOfrecerNotificaciones({
      estado: push.estado(),
      claveActiva: true, // la clave se comprueba abajo, cuando llega
      descartadaEn: leerDescarteOferta(almacenLocal()),
      ahora: reloj.ahora(),
    }),
  );

  if (!ofrecer || descartada || !clave.data?.activo) return null;

  if (resultado) {
    return (
      <Mensaje tono={resultado === 'activadas' ? 'info' : 'aviso'}>
        {textoResultadoActivar(resultado)}
      </Mensaje>
    );
  }

  return (
    <section
      aria-labelledby="titulo-oferta-notificaciones"
      className="flex flex-col gap-3 rounded-bloque border border-borde bg-superficie-2 px-3.5 py-3"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="grid h-9 w-9 flex-none place-items-center rounded-control bg-acento-suave text-acento"
        >
          <Icono nombre="bell" tamano={18} grosor={2.2} />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h3
            id="titulo-oferta-notificaciones"
            className="font-display text-lg leading-tight font-extrabold"
          >
            ¿Te avisamos cuando tus vecinos lo confirmen?
          </h3>
          <p className="text-sm leading-[1.35] text-secundario">
            Te llega una notificación cuando se confirme el corte en tu sector y cuando vuelva el
            servicio. Nada de spam: como mucho un recordatorio al día.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Boton icono="bell" cargando={ocupado} onClick={() => void activar()}>
          Sí, avísame
        </Boton>
        <Boton
          variante="texto"
          disabled={ocupado}
          onClick={() => {
            guardarDescarteOferta(almacenLocal(), reloj.ahora());
            setDescartada(true);
          }}
        >
          Ahora no
        </Boton>
      </div>
      {error && (
        <Mensaje tono="error">
          No se pudieron activar. Revisa tu conexión e inténtalo de nuevo.
        </Mensaje>
      )}
    </section>
  );
}
