import {
  CONSENSO_N_POR_DEFECTO,
  CONSENSO_VENTANA_MIN_POR_DEFECTO,
  ESTIMACION_N_MIN_POR_DEFECTO,
} from '@blackout/shared';
import { useEffect, type ReactNode } from 'react';
import { siguientePaso } from '../aplicacion/bienvenida';
import { Contenido, EncabezadoPantalla } from '../componentes/marco/Marco';
import { Boton } from '../componentes/ui/Boton';
import { ChipSync, EstadoChip } from '../componentes/ui/Chips';
import { Consenso } from '../componentes/ui/Consenso';
import { Icono } from '../componentes/ui/Icono';
import { useConfiguracion, usePerfil, useSesion } from '../datos/consultas';
import { Enlace, useRuta, type Ruta } from '../navegacion/ruta';
import { duracion } from '../utils/formato';
import { Ejemplo } from './piezas';
import { recuerdoBienvenida } from './recuerdo';
import { empezarRecorrido } from './recorrido/empezar';

// "Cómo funciona" (D-041, resumida en D-043): la referencia corta para leer cuando haga falta. Cada
// paso dice para qué sirve o qué hacer, en una o dos frases; para aprender usando la app está el
// recorrido guiado. Los pasos que el vecino ya hizo salen marcados, en neutro (CANON §1.1).

const ENLACE_PRIMARIO =
  'inline-flex h-12 w-full items-center justify-center gap-2 rounded-boton bg-acento px-5 text-base font-semibold text-sobre-acento';

export function PantallaGuia() {
  // Abrir la guía por cualquier camino cuenta como haber visto la bienvenida.
  useEffect(() => {
    recuerdoBienvenida.marcar();
  }, []);

  const hayUsuario = useSesion() !== null;
  const perfil = usePerfil();
  const ruta = useRuta();
  const configuracion = useConfiguracion().data;
  const n = configuracion?.consensoN ?? CONSENSO_N_POR_DEFECTO;
  const nMin = configuracion?.estimacionNMin ?? ESTIMACION_N_MIN_POR_DEFECTO;
  const ventanaLuz = duracion(CONSENSO_VENTANA_MIN_POR_DEFECTO.electricidad);
  const ventanaAgua = duracion(CONSENSO_VENTANA_MIN_POR_DEFECTO.agua);
  const sector = perfil.data?.sectorNombre;
  const tienePerfil = Boolean(perfil.data);

  return (
    <Contenido>
      <EncabezadoPantalla
        titulo="Cómo funciona"
        descripcion={`Los vecinos avisan cuando se va la luz o el agua. Con ${n} avisos de un sector, el mapa cambia para todos.`}
      />

      <Boton
        variante="secundario"
        icono="map"
        className="self-start"
        onClick={() => empezarRecorrido({ hayUsuario, tienePerfil }, ruta)}
      >
        Hacer el recorrido guiado
      </Boton>

      <ol className="flex flex-col gap-2.5">
        <Paso numero={1} titulo="Mira el mapa">
          Ves qué sectores están sin luz o sin agua. No necesita cuenta.
        </Paso>

        <Paso numero={2} titulo="Crea tu cuenta" hecho={hayUsuario ? 'Ya tienes cuenta' : null}>
          Para que tus avisos cuenten como los de un vecino distinto.
        </Paso>

        <Paso numero={3} titulo="Marca tu vivienda" hecho={sector ? `Tu sector: ${sector}` : null}>
          Una sola vez, tocando tu casa en el mapa. Define tu sector; nadie ve el punto.
        </Paso>

        <Paso numero={4} titulo="Avisa cuando se va y cuando vuelve">
          En Reportar: «Se fue la luz» y, al volver, «Ya volvió la luz». Con las dos horas se sabe
          cuánto duró.
        </Paso>

        <Paso
          numero={5}
          titulo="Se confirma entre vecinos"
          ejemplo={
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-estado-sin-confirmar-tinta">
              <EstadoChip estado="sin-confirmar" />
              <Consenso llenas={1} total={n} texto={`1 de ${n} reportes`} />
            </div>
          }
        >
          Con {n} vecinos distintos en menos de {ventanaLuz} (luz) o {ventanaAgua} (agua), el sector
          cambia. Antes sale «Sin confirmar».
        </Paso>

        <Paso numero={6} titulo="Cuánto suele durar">
          La mediana de los cortes anteriores de tu sector. Con menos de {nMin}, «datos
          insuficientes».
        </Paso>

        <Paso
          numero={7}
          titulo="Sin señal también cuenta"
          ejemplo={
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm">
                <span className="font-semibold">Se fue la luz</span>
                <span className="text-secundario"> · 14:05</span>
              </p>
              <ChipSync estado="pendiente" />
            </div>
          }
        >
          El aviso espera en el teléfono y se envía solo al volver la red.
        </Paso>
      </ol>

      <Final paso={siguientePaso({ hayUsuario, tienePerfil })} />
    </Contenido>
  );
}

function Paso({
  numero,
  titulo,
  hecho = null,
  ejemplo,
  children,
}: {
  numero: number;
  titulo: string;
  /** Qué ya hizo el vecino en este paso ("Ya tienes cuenta"); `null` si falta. */
  hecho?: string | null;
  ejemplo?: ReactNode;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-3 rounded-tarjeta border border-borde bg-superficie p-4 lg:gap-4 lg:px-5">
      <span
        aria-hidden="true"
        className="grid h-8 w-8 flex-none place-items-center rounded-full bg-acento font-display text-[15px] font-extrabold text-sobre-acento tabular-nums"
      >
        {hecho ? <Icono nombre="check" tamano={16} grosor={2.6} /> : numero}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <h2 className="pt-1 text-base leading-tight font-bold">
          <span className="sr-only">Paso {numero}: </span>
          {titulo}
        </h2>
        {/* Neutro a propósito: el color con croma solo significa estado (CANON §1.1). */}
        {hecho && (
          <p className="inline-flex items-center gap-1.5 self-start rounded-chip bg-acento-suave px-2.5 py-1 text-[13px] font-semibold text-texto">
            <Icono nombre="check" tamano={14} grosor={2.4} />
            {hecho}
          </p>
        )}
        <p className="text-[15px] leading-[1.45] text-texto-2">{children}</p>
        {ejemplo && (
          <div className="mt-1">
            <Ejemplo>{ejemplo}</Ejemplo>
          </div>
        )}
      </div>
    </li>
  );
}

const FINAL: Record<
  ReturnType<typeof siguientePaso>,
  { texto: string; boton: string; a: Ruta; consulta?: Record<string, string> }
> = {
  'crear-cuenta': {
    texto: 'Cuenta y vivienda toman un par de minutos, una sola vez.',
    boton: 'Crear cuenta',
    a: '/entrar',
    consulta: { siguiente: '/registro', modo: 'crear' },
  },
  'marcar-vivienda': {
    texto: 'Te falta marcar tu vivienda para que tus avisos cuenten en tu sector.',
    boton: 'Marcar mi vivienda',
    a: '/registro',
    consulta: { siguiente: '/cuenta' },
  },
  reportar: {
    texto: 'Ya estás registrado. Cuando se vaya la luz o el agua, avísalo.',
    boton: 'Reportar un corte',
    a: '/reportar',
  },
};

function Final({ paso }: { paso: ReturnType<typeof siguientePaso> }) {
  const { texto, boton, a, consulta } = FINAL[paso];
  return (
    <section
      aria-labelledby="titulo-empieza"
      className="flex flex-col gap-3 rounded-tarjeta border border-borde bg-superficie p-4 lg:p-6"
    >
      <h2 id="titulo-empieza" className="text-lg leading-tight font-bold">
        Empieza ahora
      </h2>
      <p className="text-sm text-secundario">{texto}</p>
      <Enlace a={a} consulta={consulta} className={ENLACE_PRIMARIO}>
        {boton}
      </Enlace>
    </section>
  );
}
