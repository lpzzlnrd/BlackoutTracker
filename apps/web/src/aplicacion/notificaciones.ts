import type { Puertos } from '../datos/puertos';
import type { EstadoPush } from '../dominio/push';

// Casos de uso de las notificaciones push (T-072, D-042): activarlas, desactivarlas, mantener la
// suscripción al día en el servidor y decidir cuándo se ofrecen. El permiso nunca se pide al
// abrir la app: se ofrece después de un reporte, que es cuando el vecino entiende para qué sirve.

export type DependenciasNotificaciones = Pick<Puertos, 'notificaciones' | 'push'>;

type AlmacenNavegador = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const DIA_MS = 86_400_000;

export type ResultadoActivar = 'activadas' | 'denegado' | 'inactivo' | 'no-soportado';

/**
 * Pide el permiso, suscribe este navegador y lo da de alta en la API. Sin claves en el servidor
 * (`inactivo`) no pide nada: sería pedir un permiso que no se va a usar.
 */
export async function activarNotificaciones({
  notificaciones,
  push,
}: DependenciasNotificaciones): Promise<ResultadoActivar> {
  const estado = push.estado();
  if (estado === 'no-soportado' || estado === 'requiere-instalar') return 'no-soportado';
  if (estado === 'denegado') return 'denegado';
  const clave = await notificaciones.clave();
  if (!clave.activo || !clave.clavePublica) return 'inactivo';
  const suscripcion = await push.suscribir(clave.clavePublica);
  if (!suscripcion) return 'denegado';
  await notificaciones.suscribir(suscripcion);
  return 'activadas';
}

/**
 * Da de baja este navegador: primero en la API (necesita el `endpoint` y la sesión) y después en
 * el navegador. Sin red, la baja local se hace igual: la próxima vez que el servidor intente
 * enviar, el servicio push le responderá 410 y borrará la suscripción él solo.
 */
export async function desactivarNotificaciones({
  notificaciones,
  push,
}: DependenciasNotificaciones): Promise<void> {
  const actual = await push.actual();
  if (!actual) return;
  try {
    await notificaciones.darDeBaja({ endpoint: actual.endpoint });
  } catch {
    // ver arriba: el servidor la limpia cuando el servicio push la rechace
  }
  await push.anular();
}

/** Recuerdo de la última vez que esta suscripción se mandó a la API. */
export const CLAVE_SINCRONIZADA = 'push-sincronizada';

/**
 * Vuelve a mandar la suscripción a la API al abrir la app, a lo sumo una vez al día por
 * `endpoint`. El navegador puede rotar la suscripción sin avisar, y el service worker no puede
 * mandarla él (no tiene la sesión). Devuelve si hizo la llamada.
 */
export async function sincronizarSuscripcion(
  { notificaciones, push }: DependenciasNotificaciones,
  { almacen, ahora }: { almacen: AlmacenNavegador | undefined; ahora: string },
): Promise<boolean> {
  if (push.estado() !== 'concedido') return false;
  const actual = await push.actual();
  if (!actual) return false;
  const previo = leerJson<{ endpoint: string; en: string }>(almacen, CLAVE_SINCRONIZADA);
  if (previo?.endpoint === actual.endpoint && Date.parse(ahora) - Date.parse(previo.en) < DIA_MS) {
    return false;
  }
  await notificaciones.suscribir(actual);
  escribir(almacen, CLAVE_SINCRONIZADA, JSON.stringify({ endpoint: actual.endpoint, en: ahora }));
  return true;
}

// ─── La oferta tras un reporte ───────────────────────────────────────────────────────────────

export const CLAVE_OFERTA = 'notificaciones-oferta-descartada';
/** Tras un "Ahora no", la oferta no vuelve hasta dentro de una semana. */
export const OFERTA_PAUSA_DIAS = 7;

/**
 * "¿Te avisamos cuando tus vecinos lo confirmen?" sale solo si el permiso aún no se pidió, el
 * servidor tiene claves y el vecino no dijo "Ahora no" en la última semana.
 */
export function debeOfrecerNotificaciones({
  estado,
  claveActiva,
  descartadaEn,
  ahora,
}: {
  estado: EstadoPush;
  claveActiva: boolean;
  descartadaEn: string | null;
  ahora: string;
}): boolean {
  if (estado !== 'pendiente' || !claveActiva) return false;
  if (!descartadaEn) return true;
  const desde = Date.parse(descartadaEn);
  return Number.isNaN(desde) || Date.parse(ahora) - desde >= OFERTA_PAUSA_DIAS * DIA_MS;
}

export const leerDescarteOferta = (almacen: AlmacenNavegador | undefined): string | null =>
  leer(almacen, CLAVE_OFERTA);

export const guardarDescarteOferta = (almacen: AlmacenNavegador | undefined, ahora: string) =>
  escribir(almacen, CLAVE_OFERTA, ahora);

// `localStorage` puede no existir o lanzar (modo privado, iframes): entonces no se recuerda nada.

function leer(almacen: AlmacenNavegador | undefined, clave: string): string | null {
  try {
    return almacen?.getItem(clave) ?? null;
  } catch {
    return null;
  }
}

function leerJson<T>(almacen: AlmacenNavegador | undefined, clave: string): T | null {
  const texto = leer(almacen, clave);
  if (!texto) return null;
  try {
    return JSON.parse(texto) as T;
  } catch {
    return null;
  }
}

function escribir(almacen: AlmacenNavegador | undefined, clave: string, valor: string): void {
  try {
    almacen?.setItem(clave, valor);
  } catch {
    // sin almacenamiento: vale para esta pestaña
  }
}
