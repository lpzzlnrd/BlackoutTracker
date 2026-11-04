import type { SuscripcionPushSolicitud } from '@blackout/shared';

// Web Push en el cliente (T-072, D-042): qué puede hacer este navegador y cómo se traduce su
// suscripción al cuerpo de la API. Lógica pura, sin `window`: el adaptador del navegador le pasa
// lo que lee.

/**
 * Lo que este dispositivo puede hacer con las notificaciones:
 * - `no-soportado`: el navegador no tiene Web Push.
 * - `requiere-instalar`: iPhone o iPad con Safari, sin la app en la pantalla de inicio. Apple solo
 *   entrega notificaciones web a las apps instaladas (iOS 16.4 o más).
 * - `pendiente`: todavía no se ha pedido el permiso.
 * - `concedido` / `denegado`: el vecino ya respondió.
 */
export type EstadoPush =
  'no-soportado' | 'requiere-instalar' | 'pendiente' | 'concedido' | 'denegado';

/** iPhone, iPod o iPad (el iPad moderno se presenta como "MacIntel" con pantalla táctil). */
export function esIOS({
  userAgent,
  platform,
  maxTouchPoints,
}: {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
}): boolean {
  return /iPad|iPhone|iPod/.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1);
}

export function estadoPush({
  soportaPush,
  permiso,
  ios,
  instalada,
}: {
  soportaPush: boolean;
  /** `Notification.permission`. */
  permiso: 'default' | 'granted' | 'denied';
  ios: boolean;
  /** La app corre como PWA instalada (`display-mode: standalone`). */
  instalada: boolean;
}): EstadoPush {
  if (!soportaPush) return ios && !instalada ? 'requiere-instalar' : 'no-soportado';
  if (permiso === 'granted') return 'concedido';
  if (permiso === 'denied') return 'denegado';
  return 'pendiente';
}

/** La clave pública VAPID (base64url) en bytes, como la pide `pushManager.subscribe`. */
export function claveABytes(base64url: string): Uint8Array<ArrayBuffer> {
  const relleno = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + relleno).replace(/-/g, '+').replace(/_/g, '/');
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

/**
 * Si la suscripción existente se hizo con esta misma clave. Si el servidor cambió sus claves VAPID,
 * hay que anularla y suscribirse de nuevo: `subscribe` con otra clave falla.
 */
export function mismaClave(actual: ArrayBuffer | null, nueva: Uint8Array): boolean {
  if (!actual || actual.byteLength !== nueva.byteLength) return false;
  const a = new Uint8Array(actual);
  return a.every((byte, i) => byte === nueva[i]);
}

/** `PushSubscription.toJSON()` → el cuerpo de `PUT /notificaciones/suscripcion`. */
export function aSolicitud(json: {
  endpoint?: string;
  keys?: Record<string, string>;
}): SuscripcionPushSolicitud | null {
  const { endpoint, keys } = json;
  if (!endpoint || !keys?.p256dh || !keys.auth) return null;
  return { endpoint, claves: { p256dh: keys.p256dh, auth: keys.auth } };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** El `?n=` de una notificación abierta: solo un UUID; cualquier otra cosa se ignora. */
export const esIdNotificacion = (valor: string | null): valor is string =>
  valor !== null && UUID.test(valor);
