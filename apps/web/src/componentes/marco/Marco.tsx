import type { ReactNode } from 'react';
import { usePuertos, useObservable } from '../../datos/contexto';
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

const NAVEGACION: readonly ElementoNav[] = [
  { ruta: '/', texto: 'Mapa', icono: 'map' },
  { ruta: '/panel', texto: 'Panel', icono: 'grid' },
  { ruta: '/reportar', texto: 'Reportar', icono: 'plus', iconoEscritorio: 'plus-circle' },
  { ruta: '/cuenta', texto: 'Cuenta', icono: 'user' },
];

/** Entrar y registrarse cuelgan de Cuenta. */
const seccionActiva = (ruta: Ruta): Ruta =>
  ruta === '/entrar' || ruta === '/registro' ? '/cuenta' : ruta;

export function Marco({ children, pie }: { children: ReactNode; pie?: ReactNode }) {
  const { conexion } = usePuertos();
  const estadoConexion = useObservable(conexion);
  const activa = seccionActiva(useRuta());

  return (
    <div className="flex h-dvh flex-col bg-fondo lg:flex-row">
      <BarraLateral activa={activa}>
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
        <NavInferior activa={activa} />
      </div>
    </div>
  );
}

function NavInferior({ activa }: { activa: Ruta }) {
  return (
    <nav
      aria-label="Principal"
      className="flex flex-none justify-around border-t border-borde bg-superficie px-2 pt-2 lg:hidden"
      style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
    >
      {NAVEGACION.map(({ ruta, texto, icono }) => {
        const actual = ruta === activa;
        const reportar = ruta === '/reportar';
        const pildora = reportar
          ? 'bg-acento text-sobre-acento'
          : actual
            ? 'bg-acento-suave text-acento'
            : 'text-secundario';
        const etiqueta =
          reportar || actual ? 'font-bold text-acento' : 'font-semibold text-secundario';
        return (
          <Enlace
            key={ruta}
            a={ruta}
            aria-current={actual ? 'page' : undefined}
            className="flex min-h-14 min-w-[72px] flex-col items-center gap-1 pt-0.5 text-xs"
          >
            <span className={`grid h-[30px] w-14 place-items-center rounded-[15px] ${pildora}`}>
              <Icono nombre={icono} tamano={22} grosor={reportar ? 2.4 : 2} />
            </span>
            <span className={etiqueta}>{texto}</span>
          </Enlace>
        );
      })}
    </nav>
  );
}

function BarraLateral({ activa, children }: { activa: Ruta; children: ReactNode }) {
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
