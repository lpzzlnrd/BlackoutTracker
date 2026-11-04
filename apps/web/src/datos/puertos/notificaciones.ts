import type {
  BajaSuscripcionSolicitud,
  ClavePushDto,
  PreferenciasNotificacionesDto,
  SuscripcionPushSolicitud,
} from '@blackout/shared';
import type { EstadoPush } from '../../dominio/push';

/** Las notificaciones en la API (T-072, D-042). Todo con sesión salvo `clave`. */
export interface RepositorioNotificaciones {
  /** `GET /notificaciones/clave`: la clave pública VAPID; `activo: false` si el servidor no tiene. */
  clave(): Promise<ClavePushDto>;
  /** `PUT /notificaciones/suscripcion`: da de alta (o actualiza) este dispositivo. */
  suscribir(solicitud: SuscripcionPushSolicitud): Promise<void>;
  /** `DELETE /notificaciones/suscripcion`. */
  darDeBaja(solicitud: BajaSuscripcionSolicitud): Promise<void>;
  /** `GET /notificaciones/preferencias`. */
  preferencias(): Promise<PreferenciasNotificacionesDto>;
  /** `PATCH /notificaciones/preferencias`: devuelve las preferencias completas. */
  cambiarPreferencias(
    cambios: Partial<PreferenciasNotificacionesDto>,
  ): Promise<PreferenciasNotificacionesDto>;
  /** `POST /notificaciones/:id/abierta`: el vecino la tocó (métrica de apertura y pausa). */
  marcarAbierta(id: string): Promise<void>;
}

/**
 * Web Push en este navegador: permiso y suscripción. La API no sabe nada de esto; solo recibe el
 * resultado (`SuscripcionPushSolicitud`).
 */
export interface PushDispositivo {
  /** Lo que el navegador permite ahora mismo (se lee en cada llamada: el permiso puede cambiar). */
  estado(): EstadoPush;
  /** La suscripción de este navegador, o `null` si no hay. */
  actual(): Promise<SuscripcionPushSolicitud | null>;
  /**
   * Pide el permiso (si hace falta) y se suscribe con la clave pública. `null` si el vecino no da
   * el permiso.
   */
  suscribir(clavePublica: string): Promise<SuscripcionPushSolicitud | null>;
  /** Anula la suscripción de este navegador. Devuelve su `endpoint`, o `null` si no había. */
  anular(): Promise<string | null>;
}
