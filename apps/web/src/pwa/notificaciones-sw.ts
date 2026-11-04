import {
  AccionNotificacion,
  TIPOS_NOTIFICACION,
  type NotificacionPushDto,
  type TipoServicio,
} from '@blackout/shared';

// Lo que el service worker hace con un push (T-072, D-042), en funciones puras para probarlas sin
// navegador. `sw.ts` solo las conecta a los eventos `push` y `notificationclick`.

/** Vibración distinta por servicio, para saber cuál es sin mirar (donde el sistema la respeta). */
export const VIBRACION: Readonly<Record<TipoServicio, readonly number[]>> = {
  electricidad: [100, 50, 100, 50, 100],
  agua: [300, 120, 300],
};

/** El icono de la app, a color, al lado del texto. */
export const ICONO = '/pwa-192.png';
/**
 * La insignia de la barra de estado de Android: un hexágono con un rayo calado, blanco sobre
 * transparente (Android solo usa el canal alfa; con el icono a color saldría un cuadrado blanco).
 */
export const INSIGNIA = '/insignia-96.png';

/** Lo que se muestra si llega un push que no se entiende: Chrome castiga los push sin notificación. */
export const NOTIFICACION_GENERICA = {
  titulo: 'BlackoutTracker',
  opciones: { body: 'Hay novedades en tu sector.', icon: ICONO, badge: INSIGNIA, lang: 'es-VE' },
} as const;

/** Lo que la notificación guarda para el clic (`notification.data`). */
export interface DatosNotificacion {
  id: string;
  url: string;
  tipoServicio: TipoServicio | null;
}

/**
 * Las opciones que usamos de `showNotification`. `actions`, `image`, `renotify` y `vibrate` no
 * están en los tipos de TypeScript porque no todos los navegadores las tienen: los que no, las
 * ignoran (Safari y Firefox no muestran botones ni imagen; el texto basta).
 */
export interface OpcionesNotificacion extends NotificationOptions {
  actions?: { action: string; title: string }[];
  image?: string;
  renotify?: boolean;
  vibrate?: number[];
  timestamp?: number;
}

const esTexto = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

/** Una ruta de esta app: empieza por `/` pero no por `//` (eso sería otro dominio). */
export const esRutaPropia = (url: unknown): url is string =>
  typeof url === 'string' && url.startsWith('/') && !url.startsWith('//');

const esServicio = (v: unknown): v is TipoServicio => v === 'agua' || v === 'electricidad';

/**
 * Valida el cuerpo del push. Viene cifrado desde nuestra API, pero un mensaje que no se entiende
 * se descarta en vez de mostrar una notificación rota.
 */
export function leerNotificacion(dato: unknown): NotificacionPushDto | null {
  if (typeof dato !== 'object' || dato === null) return null;
  const d = dato as Record<string, unknown>;
  if (
    !esTexto(d.id) ||
    !esTexto(d.titulo) ||
    !esTexto(d.etiqueta) ||
    !esRutaPropia(d.url) ||
    !(TIPOS_NOTIFICACION as readonly unknown[]).includes(d.tipo)
  ) {
    return null;
  }
  const acciones = Array.isArray(d.acciones)
    ? (d.acciones as unknown[]).flatMap((a) => {
        const accion = (a as Record<string, unknown> | null)?.accion;
        const titulo = (a as Record<string, unknown> | null)?.titulo;
        return (accion === AccionNotificacion.SeFue || accion === AccionNotificacion.AquiSiHay) &&
          esTexto(titulo)
          ? [{ accion, titulo }]
          : [];
      })
    : [];
  return {
    id: d.id,
    tipo: d.tipo as NotificacionPushDto['tipo'],
    titulo: d.titulo,
    cuerpo: typeof d.cuerpo === 'string' ? d.cuerpo : '',
    etiqueta: d.etiqueta,
    url: d.url,
    renotificar: d.renotificar !== false,
    tipoServicio: esServicio(d.tipoServicio) ? d.tipoServicio : null,
    imagen: typeof d.imagen === 'string' && d.imagen.startsWith('https://') ? d.imagen : null,
    acciones,
  };
}

/**
 * Título y opciones de `showNotification`. La etiqueta (`tag`) es la del corte: la notificación de
 * "se fue" se reemplaza por la de "volvió" en vez de apilarse (D-042, idea a).
 */
export function opcionesDeNotificacion(
  n: NotificacionPushDto,
  ahora: number,
): { titulo: string; opciones: OpcionesNotificacion } {
  const datos: DatosNotificacion = { id: n.id, url: n.url, tipoServicio: n.tipoServicio };
  return {
    titulo: n.titulo,
    opciones: {
      body: n.cuerpo,
      tag: n.etiqueta,
      renotify: n.renotificar,
      icon: ICONO,
      badge: INSIGNIA,
      lang: 'es-VE',
      ...(n.imagen ? { image: n.imagen } : {}),
      vibrate: [...(n.tipoServicio ? VIBRACION[n.tipoServicio] : [200])],
      actions: n.acciones.map((a) => ({ action: a.accion, title: a.titulo })),
      timestamp: ahora,
      data: datos,
    },
  };
}

/**
 * A dónde lleva un clic. «Se fue» abre Reportar con el aviso de inicio listo (el vecino lo
 * confirma con un toque: así pasa por la cola, con su hora y su id, OFF-03 y OFF-05). «Aquí sí
 * hay» solo cierra: no hay un reporte de "sí hay servicio". Sin botón, la ruta de la notificación.
 */
export function destinoDelClic(datos: unknown, accion: string): string | null {
  if (accion === AccionNotificacion.AquiSiHay) return null;
  const d = (
    typeof datos === 'object' && datos !== null ? datos : {}
  ) as Partial<DatosNotificacion>;
  if (accion === AccionNotificacion.SeFue && esServicio(d.tipoServicio) && esTexto(d.id)) {
    const consulta = new URLSearchParams({
      servicio: d.tipoServicio,
      accion: AccionNotificacion.SeFue,
      n: d.id,
    });
    return `/reportar?${consulta.toString()}`;
  }
  return esRutaPropia(d.url) ? d.url : '/';
}

/** El mensaje que el service worker manda a una pestaña abierta para que navegue sin recargar. */
export interface MensajeNavegar {
  tipo: 'navegar';
  url: string;
}

export const esMensajeNavegar = (dato: unknown): dato is MensajeNavegar =>
  typeof dato === 'object' &&
  dato !== null &&
  (dato as Record<string, unknown>).tipo === 'navegar' &&
  esRutaPropia((dato as Record<string, unknown>).url);
