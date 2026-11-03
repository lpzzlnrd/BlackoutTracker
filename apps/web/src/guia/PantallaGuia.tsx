import {
  CONSENSO_N_POR_DEFECTO,
  CONSENSO_VENTANA_MIN_POR_DEFECTO,
  ESTIMACION_N_MIN_POR_DEFECTO,
} from '@blackout/shared';
import { useEffect, type ReactNode } from 'react';
import { siguientePaso } from '../aplicacion/bienvenida';
import { Contenido, EncabezadoPantalla } from '../componentes/marco/Marco';
import { BloqueEstimacion } from '../componentes/ui/BloqueEstimacion';
import { ChipSync, EstadoChip } from '../componentes/ui/Chips';
import { Consenso } from '../componentes/ui/Consenso';
import { Icono, type NombreIcono } from '../componentes/ui/Icono';
import { useConfiguracion, usePerfil, useSesion } from '../datos/consultas';
import { Enlace, type Ruta } from '../navegacion/ruta';
import { duracion } from '../utils/formato';
import { recuerdoBienvenida } from './recuerdo';

// "Cómo funciona" (T-071, D-041): la guía paso a paso para vecinos, de mirar el mapa a reportar
// sin conexión. Las muestras usan las piezas reales de la app (chips, consenso, estimación) con
// datos de ejemplo, siempre bajo el rótulo "Ejemplo" para que no se confundan con el estado real.
// Los pasos que el vecino ya hizo se marcan como hechos.

const ENLACE_PRIMARIO =
  'inline-flex h-12 w-full items-center justify-center gap-2 rounded-boton bg-acento px-5 text-base font-semibold text-sobre-acento';
const ENLACE_SECUNDARIO =
  'inline-flex h-11 items-center justify-center gap-2 self-start rounded-control border border-borde-control bg-superficie px-4 text-sm font-semibold text-texto';

export function PantallaGuia() {
  // Abrir la guía por cualquier camino cuenta como haber visto la bienvenida.
  useEffect(() => {
    recuerdoBienvenida.marcar();
  }, []);

  const hayUsuario = useSesion() !== null;
  const perfil = usePerfil();
  const configuracion = useConfiguracion().data;
  const n = configuracion?.consensoN ?? CONSENSO_N_POR_DEFECTO;
  const nMin = configuracion?.estimacionNMin ?? ESTIMACION_N_MIN_POR_DEFECTO;
  const ventanaLuz = duracion(CONSENSO_VENTANA_MIN_POR_DEFECTO.electricidad);
  const ventanaAgua = duracion(CONSENSO_VENTANA_MIN_POR_DEFECTO.agua);
  const sector = perfil.data?.sectorNombre;

  return (
    <Contenido>
      <EncabezadoPantalla
        titulo="Cómo funciona"
        descripcion="BlackoutTracker junta los avisos de los vecinos de la Gran Valencia para saber, sector por sector, dónde se fue la luz o el agua y cuánto suele durar el corte."
      />

      <ol className="flex flex-col gap-3">
        <Paso numero={1} titulo="Mira el mapa, sin cuenta">
          <Texto>
            El mapa y el panel están abiertos para todos. Cada hexágono es un sector y su color dice
            cómo está el servicio. Arriba eliges si ves la luz o el agua.
          </Texto>
          <Ejemplo>
            <div className="flex flex-wrap gap-2">
              <EstadoChip estado="con-servicio" />
              <EstadoChip estado="sin-confirmar" texto="largo" />
              <EstadoChip estado="sin-servicio" />
              <EstadoChip estado="sin-datos" />
            </div>
          </Ejemplo>
          <Accion a="/" icono="map">
            Ver el mapa
          </Accion>
        </Paso>

        <Paso numero={2} titulo="Crea tu cuenta" hecho={hayUsuario ? 'Ya tienes cuenta' : null}>
          <Texto>
            Para reportar necesitas una cuenta con tu correo y una contraseña. Así cada aviso cuenta
            como el de un vecino distinto. Si te pide confirmar el correo, abre el enlace que te
            llega.
          </Texto>
          {!hayUsuario && (
            <Accion a="/entrar" consulta={{ siguiente: '/registro', modo: 'crear' }} icono="user">
              Crear cuenta
            </Accion>
          )}
        </Paso>

        <Paso
          numero={3}
          titulo="Marca tu vivienda, una sola vez"
          hecho={sector ? `Tu sector: ${sector}` : null}
        >
          <Texto>
            Pones un pin sobre tu casa en el mapa; no hace falta el GPS. Tu sector es el hexágono
            que la contiene, y ahí cuentan tus avisos. Nadie ve tu punto: el mapa solo muestra
            sectores.
          </Texto>
          <Ejemplo>
            <div className="flex items-center gap-3">
              <Hexagono />
              <div>
                <p className="text-xs text-secundario">Tu sector</p>
                <p className="font-bold">Guaparo</p>
              </div>
            </div>
          </Ejemplo>
          {hayUsuario && perfil.data === null && (
            <Accion a="/registro" consulta={{ siguiente: '/cuenta' }} icono="home">
              Marcar mi vivienda
            </Accion>
          )}
        </Paso>

        <Paso numero={4} titulo="Avisa cuando se va y cuando vuelve">
          <Texto>
            En Reportar eliges Luz o Agua y tocas «Se fue la luz». Cuando regrese, tocas «Ya volvió
            la luz»: con las dos horas se sabe cuánto duró el corte. Puedes tener abierto un corte
            de luz y otro de agua a la vez.
          </Texto>
          <Accion a="/reportar" icono="plus-circle">
            Reportar un corte
          </Accion>
        </Paso>

        <Paso numero={5} titulo="Cómo se confirma un corte">
          <Texto>
            Un solo aviso no cambia el mapa. El sector pasa a «Sin servicio» cuando {n} vecinos
            distintos lo reportan en menos de {ventanaLuz} si es la luz, o de {ventanaAgua} si es el
            agua. Mientras tanto se ve «Reportes sin confirmar». La vuelta del servicio se confirma
            igual. No hay un administrador: lo deciden los vecinos.
          </Texto>
          <Ejemplo>
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-estado-sin-confirmar-tinta">
                <EstadoChip estado="sin-confirmar" />
                <Consenso llenas={1} total={n} texto={`1 de ${n} reportes`} />
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-estado-sin-servicio-tinta">
                <EstadoChip estado="sin-servicio" />
                <Consenso llenas={n} total={n} texto={`${n} de ${n} reportes`} />
              </div>
            </div>
          </Ejemplo>
        </Paso>

        <Paso numero={6} titulo="Cuánto suele durar">
          <Texto>
            Con los cortes ya cerrados de cada sector se calcula la mediana: lo que dura un corte
            típico, sin que uno muy largo la desvíe. Siempre ves en cuántos cortes se basa, y la luz
            y el agua se calculan por separado. Con menos de {nMin} cortes no hay cifra. Es una
            estimación estadística, no una promesa.
          </Texto>
          <Ejemplo>
            <div className="flex flex-col gap-3">
              <BloqueEstimacion
                estimacion={{ suficiente: true, n: 12, medianaMin: 240 }}
                nMin={nMin}
              />
              <div className="border-t border-borde-2 pt-3">
                <BloqueEstimacion estimacion={{ suficiente: false, n: 3 }} nMin={nMin} />
              </div>
            </div>
          </Ejemplo>
        </Paso>

        <Paso numero={7} titulo="Sin conexión también cuenta">
          <Texto>
            Si no hay señal, tu aviso se guarda en el teléfono con la hora en que pasó y se envía
            solo cuando vuelve la conexión. Mientras tanto lo ves en Avisos como «Pendiente». Sin
            red, el mapa muestra lo último que se guardó y te dice de qué hora es.
          </Texto>
          <Ejemplo>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm">
                <span className="font-semibold">Se fue la luz</span>
                <span className="text-secundario"> · 14:05</span>
              </p>
              <ChipSync estado="pendiente" />
            </div>
          </Ejemplo>
          <Accion a="/avisos" icono="clock">
            Ver tus avisos
          </Accion>
        </Paso>
      </ol>

      <Final paso={siguientePaso({ hayUsuario, tienePerfil: Boolean(perfil.data) })} />
    </Contenido>
  );
}

function Paso({
  numero,
  titulo,
  hecho = null,
  children,
}: {
  numero: number;
  titulo: string;
  /** Qué ya hizo el vecino en este paso ("Ya tienes cuenta"); `null` si falta. */
  hecho?: string | null;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-3 rounded-tarjeta border border-borde bg-superficie p-4 lg:gap-4 lg:p-6">
      <span
        aria-hidden="true"
        className="grid h-9 w-9 flex-none place-items-center rounded-full bg-acento font-display text-base font-extrabold text-sobre-acento tabular-nums"
      >
        {hecho ? <Icono nombre="check" tamano={18} grosor={2.6} /> : numero}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <h2 className="pt-1.5 text-lg leading-tight font-bold">
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
        </div>
        {children}
      </div>
    </li>
  );
}

function Texto({ children }: { children: ReactNode }) {
  return <p className="text-[15px] leading-[1.5] text-texto-2">{children}</p>;
}

/** Una muestra con datos inventados: el rótulo evita que se lea como el estado real. */
function Ejemplo({ children }: { children: ReactNode }) {
  return (
    <figure className="flex flex-col gap-2.5 rounded-bloque bg-superficie-2 p-3">
      <figcaption className="text-xs font-semibold text-secundario">Ejemplo</figcaption>
      {children}
    </figure>
  );
}

function Accion({
  a,
  consulta,
  icono,
  children,
}: {
  a: Ruta;
  consulta?: Record<string, string>;
  icono: NombreIcono;
  children: ReactNode;
}) {
  return (
    <Enlace a={a} consulta={consulta} className={ENLACE_SECUNDARIO}>
      <Icono nombre={icono} tamano={18} />
      {children}
    </Enlace>
  );
}

/** El sector como en el mapa: un hexágono (D-040) con la casa, nunca un punto (CANON §1.3). */
function Hexagono() {
  return (
    <span aria-hidden="true" className="relative grid h-11 w-11 flex-none place-items-center">
      <svg width="44" height="44" viewBox="0 0 44 44" className="absolute inset-0">
        <polygon
          points="22,3 39,12.5 39,31.5 22,41 5,31.5 5,12.5"
          className="fill-superficie stroke-texto"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      </svg>
      <Icono nombre="home" tamano={18} grosor={2.4} className="relative" />
    </span>
  );
}

const FINAL: Record<
  ReturnType<typeof siguientePaso>,
  { texto: string; boton: string; a: Ruta; consulta?: Record<string, string> }
> = {
  'crear-cuenta': {
    texto: 'Crear la cuenta y marcar tu vivienda toma un par de minutos, y se hace una sola vez.',
    boton: 'Crear cuenta',
    a: '/entrar',
    consulta: { siguiente: '/registro', modo: 'crear' },
  },
  'marcar-vivienda': {
    texto:
      'Ya tienes cuenta. Te falta marcar tu vivienda para que tus avisos cuenten en tu sector.',
    boton: 'Marcar mi vivienda',
    a: '/registro',
    consulta: { siguiente: '/cuenta' },
  },
  reportar: {
    texto: 'Ya estás registrado. Cuando se vaya la luz o el agua, avísalo desde Reportar.',
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
