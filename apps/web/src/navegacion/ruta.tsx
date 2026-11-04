import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from 'react';

// Enrutador mínimo con la History API: la app tiene ocho pantallas y no necesita más. nginx (Docker)
// y Vercel devuelven `index.html` en cualquier ruta, y el service worker hace lo mismo sin red.

export type Ruta =
  '/' | '/panel' | '/reportar' | '/avisos' | '/cuenta' | '/entrar' | '/registro' | '/guia';

const RUTAS: readonly Ruta[] = [
  '/',
  '/panel',
  '/reportar',
  '/avisos',
  '/cuenta',
  '/entrar',
  '/registro',
  '/guia',
];

const oyentes = new Set<() => void>();
const avisar = () => {
  for (const oyente of [...oyentes]) oyente();
};
window.addEventListener('popstate', avisar);

function suscribir(oyente: () => void) {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

const rutaActual = (): Ruta => {
  const camino = location.pathname.replace(/\/+$/, '') || '/';
  return RUTAS.find((r) => r === camino) ?? '/';
};

/** Conserva `?demo=` al navegar: la demostración es un modo de toda la app, no de una pantalla. */
export function href(ruta: Ruta, consulta: Record<string, string> = {}): string {
  const params = new URLSearchParams();
  const demo = new URLSearchParams(location.search).get('demo');
  if (demo) params.set('demo', demo);
  for (const [clave, valor] of Object.entries(consulta)) params.set(clave, valor);
  const texto = params.toString();
  return texto ? `${ruta}?${texto}` : ruta;
}

export function navegar(
  ruta: Ruta,
  opciones: { reemplazar?: boolean; consulta?: Record<string, string> } = {},
): void {
  const destino = href(ruta, opciones.consulta);
  if (opciones.reemplazar) history.replaceState(null, '', destino);
  else history.pushState(null, '', destino);
  avisar();
  window.scrollTo(0, 0);
}

/**
 * Navega a una URL de la app con su consulta (`/reportar?servicio=agua&n=…`), como las que trae
 * una notificación. Una ruta desconocida lleva al mapa.
 */
export function navegarAUrl(url: string): void {
  const destino = new URL(url, location.origin);
  const camino = destino.pathname.replace(/\/+$/, '') || '/';
  const ruta = RUTAS.find((r) => r === camino) ?? '/';
  const consulta = Object.fromEntries(
    [...destino.searchParams.entries()].filter(([clave]) => clave !== 'demo'),
  );
  navegar(ruta, { consulta });
}

/** Quita un parámetro de la URL actual sin añadir una entrada al historial (p. ej. `?n=`). */
export function quitarParametro(nombre: string): void {
  const params = new URLSearchParams(location.search);
  if (!params.has(nombre)) return;
  params.delete(nombre);
  const texto = params.toString();
  history.replaceState(null, '', `${location.pathname}${texto ? `?${texto}` : ''}`);
  avisar();
}

export function useRuta(): Ruta {
  return useSyncExternalStore(suscribir, rutaActual);
}

/** Un parámetro de la URL actual (p. ej. `siguiente` tras entrar). */
export function useParametro(nombre: string): string | null {
  const buscar = useSyncExternalStore(suscribir, () => location.search);
  return new URLSearchParams(buscar).get(nombre);
}

/** Lee `siguiente` y lo valida: solo se vuelve a una ruta de la app. */
export const rutaSegura = (valor: string | null, porDefecto: Ruta = '/'): Ruta =>
  RUTAS.find((r) => r === valor) ?? porDefecto;

type PropsEnlace = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  a: Ruta;
  consulta?: Record<string, string>;
};

/** `<a>` de verdad (se puede abrir en otra pestaña) que navega sin recargar la página. */
export function Enlace({ a, consulta, onClick, ...resto }: PropsEnlace) {
  const alPulsar = (evento: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(evento);
    if (
      evento.defaultPrevented ||
      evento.button !== 0 ||
      evento.metaKey ||
      evento.ctrlKey ||
      evento.shiftKey ||
      evento.altKey
    ) {
      return;
    }
    evento.preventDefault();
    navegar(a, { consulta });
  };
  return <a href={href(a, consulta)} onClick={alPulsar} {...resto} />;
}
