import type { ReactNode } from 'react';
import { useColaAvisos } from '../../datos/consultas';
import { usePuertos, useObservable } from '../../datos/contexto';
import { resumenCola, textoSinEnviar, type ResumenCola } from '../../dominio/aviso';
import { Enlace, useRuta, type Ruta } from '../../navegacion/ruta';
import { AvisoConexion, EstadoConexionLinea } from '../ui/AvisoConexion';
import { Icono, Marca, type NombreIcono } from '../ui/Icono';

// El armazón de la propuesta A (A §3 y §4), en flat (D-028): navegación inferior en el teléfono y
// barra lateral desde 1024 px, el único punto de quiebre (CANON §2). Lo fijo no hace scroll; el
// contenido central sí.

interface ElementoNav {
  ruta: Ruta;
  texto: string;
  icono: NombreIcono;
  iconoEscritorio?: NombreIcono;
}

/** Cinco destinos con Reportar en el medio (D-037). */
const NAVEGACION: readonly ElementoNav[] = [
  { ruta: '/', texto: 'Mapa', icono: 'map' },
  { ruta: '/panel', texto: 'Panel', icono: 'grid' },
  { ruta: '/reportar', texto: 'Reportar', icono: 'plus', iconoEscritorio: 'plus-circle' },
  { ruta: '/avisos', texto: 'Avisos', icono: 'clock' },
  { ruta: '/cuenta', texto: 'Cuenta', icono: 'user' },
];

/** Entrar y registrarse cuelgan de Cuenta. */
const seccionActiva = (ruta: Ruta): Ruta =>
  ruta === '/entrar' || ruta === '/registro' ? '/cuenta' : ruta;

export function Marco({ children, pie }: { children: ReactNode; pie?: ReactNode }) {
  const { conexion } = usePuertos();
  const estadoConexion = useObservable(conexion);
  const activa = seccionActiva(useRuta());
  const resumen = resumenCola(useColaAvisos().data);

  return (
    <div className="flex h-dvh flex-col bg-fondo lg:flex-row">
      <BarraLateral activa={activa} resumen={resumen}>
        {pie}
        <EstadoConexionLinea conexion={estadoConexion} />
      </BarraLateral>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="lg:hidden">
          <AvisoConexion conexion={estadoConexion} />
        </div>
        <main id="contenido" className="relative min-h-0 flex-1 overflow-y-auto">
          {children}
        </main>
        <NavInferior activa={activa} resumen={resumen} />
      </div>
    </div>
  );
}

/**
 * Insignia de Avisos: cuántos avisos no llegaron al servidor, roja si alguno se rechazó. Es solo
 * visual; el nombre accesible del enlace lo completa `TextoInsignia`.
 */
function InsigniaAvisos({ resumen, className }: { resumen: ResumenCola; className: string }) {
  if (resumen.sinEnviar === 0) return null;
  const color = resumen.conError
    ? 'bg-estado-sin-servicio-tinta text-estado-sin-servicio-chip'
    : 'bg-estado-sin-confirmar-tinta text-estado-sin-confirmar-chip';
  return (
    <span
      aria-hidden="true"
      className={`grid h-5 min-w-5 place-items-center rounded-chip px-1 text-xs font-bold tabular-nums ${color} ${className}`}
    >
      {resumen.sinEnviar}
    </span>
  );
}

/** "Avisos, 2 avisos sin enviar" para el lector de pantalla. */
function TextoInsignia({ resumen }: { resumen: ResumenCola }) {
  if (resumen.sinEnviar === 0) return null;
  return <span className="sr-only">, {textoSinEnviar(resumen.sinEnviar)}</span>;
}

function NavInferior({ activa, resumen }: { activa: Ruta; resumen: ResumenCola }) {
  return (
    <nav
      aria-label="Principal"
      // Encima de las capas del mapa (llegan a 1000): el botón de Reportar sobresale de la barra.
      className="relative z-[1050] grid flex-none grid-cols-5 border-t border-borde bg-superficie px-1 pt-2 lg:hidden"
      style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
    >
      {NAVEGACION.map(({ ruta, texto, icono }) => {
        const actual = ruta === activa;
        if (ruta === '/reportar') {
          return <BotonReportar key={ruta} texto={texto} icono={icono} actual={actual} />;
        }
        const pildora = actual ? 'bg-acento-suave text-acento' : 'text-secundario';
        const etiqueta = actual ? 'font-bold text-acento' : 'font-semibold text-secundario';
        return (
          <Enlace
            key={ruta}
            a={ruta}
            aria-current={actual ? 'page' : undefined}
            className="flex min-h-14 min-w-0 flex-col items-center gap-1 pt-0.5 text-xs"
          >
            <span
              className={`relative grid h-[30px] w-12 place-items-center rounded-[15px] min-[360px]:w-14 ${pildora}`}
            >
              <Icono nombre={icono} tamano={22} />
              {ruta === '/avisos' && (
                <InsigniaAvisos resumen={resumen} className="absolute -top-1.5 -right-1.5" />
              )}
            </span>
            <span className={etiqueta}>{texto}</span>
            {ruta === '/avisos' && <TextoInsignia resumen={resumen} />}
          </Enlace>
        );
      })}
    </nav>
  );
}

/**
 * Reportar en el centro de la barra (D-037): un círculo de acento de 56 px que sobresale 24 px,
 * rodeado por un anillo de 4 px del color de la barra (plano, sin sombra: D-028) que corta su borde
 * superior. En la pantalla Reportar el anillo pasa a `--acento-suave`. En el flujo ocupa lo mismo
 * que una píldora, así la etiqueta queda alineada con las demás.
 */
function BotonReportar({
  texto,
  icono,
  actual,
}: {
  texto: string;
  icono: NombreIcono;
  actual: boolean;
}) {
  return (
    <Enlace
      a="/reportar"
      aria-current={actual ? 'page' : undefined}
      className="flex min-h-14 min-w-0 flex-col items-center gap-1 pt-0.5 text-xs"
    >
      <span
        className={`-mt-[34px] grid h-16 w-16 place-items-center rounded-full p-1 ${
          actual ? 'bg-acento-suave' : 'bg-superficie'
        }`}
      >
        <span className="grid h-14 w-14 place-items-center rounded-full bg-acento text-sobre-acento">
          <Icono nombre={icono} tamano={26} grosor={2.4} />
        </span>
      </span>
      <span className="font-bold text-acento">{texto}</span>
    </Enlace>
  );
}

function BarraLateral({
  activa,
  resumen,
  children,
}: {
  activa: Ruta;
  resumen: ResumenCola;
  children: ReactNode;
}) {
  return (
    <aside className="hidden w-[232px] flex-none flex-col gap-6 border-r border-borde bg-superficie px-4 py-5 lg:flex">
      <Enlace a="/" className="flex items-center gap-2 px-2 text-[17px] font-bold">
        <Marca tamano={28} />
        BlackoutTracker
      </Enlace>
      <nav aria-label="Principal" className="flex flex-col gap-1">
        {NAVEGACION.map(({ ruta, texto, icono, iconoEscritorio }) => {
          const actual = ruta === activa;
          return (
            <Enlace
              key={ruta}
              a={ruta}
              aria-current={actual ? 'page' : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-control px-3 text-[15px] ${
                actual ? 'bg-acento-suave font-bold text-acento' : 'font-semibold text-texto-2'
              }`}
            >
              <Icono nombre={iconoEscritorio ?? icono} tamano={20} />
              {texto}
              {ruta === '/avisos' && (
                <>
                  <InsigniaAvisos resumen={resumen} className="ml-auto" />
                  <TextoInsignia resumen={resumen} />
                </>
              )}
            </Enlace>
          );
        })}
      </nav>
      <div className="mt-auto flex flex-col gap-3.5">{children}</div>
    </aside>
  );
}

/**
 * Cabecera de las pantallas que no son el mapa: un `h1` por pantalla (CANON §8) y, a la derecha,
 * lo que haga falta (el botón de pendientes, por ejemplo).
 */
export function EncabezadoPantalla({
  titulo,
  descripcion,
  accion,
}: {
  titulo: string;
  descripcion?: ReactNode;
  accion?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[22px] leading-tight font-bold lg:text-2xl">{titulo}</h1>
        {accion}
      </div>
      {descripcion && <p className="text-sm text-secundario">{descripcion}</p>}
    </header>
  );
}

/** Columna de contenido de las pantallas de lista y formularios: 640 px como máximo, centrada. */
export function Contenido({
  children,
  ancho = 'normal',
}: {
  children: ReactNode;
  ancho?: 'normal' | 'amplio';
}) {
  return (
    <div
      className={`mx-auto flex w-full flex-col gap-5 px-4 py-5 lg:px-8 lg:py-8 ${
        ancho === 'amplio' ? 'max-w-5xl' : 'max-w-[640px]'
      }`}
    >
      {children}
    </div>
  );
}
