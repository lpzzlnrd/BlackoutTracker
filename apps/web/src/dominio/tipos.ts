import type { CodigoError, EstadoServicio, FechaIso, TipoServicio } from '@blackout/shared';

// Tipos propios del cliente. Todo lo que viaja por la API se importa de `@blackout/shared`; aquí
// solo está lo que el servidor no conoce: la vista de la interfaz, la cola y la conexión.

/** Los cuatro estados que dibuja la interfaz (CANON §3). `sin-datos` lo decide el cliente. */
export type EstadoVisual = 'con-servicio' | 'sin-confirmar' | 'sin-servicio' | 'sin-datos';

/** Fila de `estado_sector` ya traducida a camelCase (datos.md §1). */
export interface EstadoSector {
  sectorId: number;
  tipoServicio: TipoServicio;
  estado: EstadoServicio;
  reportesSinConfirmar: number;
  desde: FechaIso | null;
  actualizadoEn: FechaIso;
}

/** Umbrales que el diseño muestra ("2 de 3 reportes", "3 de 5 cortes"). Petición P1. */
export interface ConfigCliente {
  consensoN: number;
  estimacionNMin: number;
}

// ─── Cola de avisos (PWA.md §7) ──────────────────────────────────────────────────────────────

export type AccionAviso = 'inicio' | 'cierre';
export type EstadoAviso = 'pendiente' | 'enviado' | 'error';

export interface AvisoCola {
  /** Clave del aviso en la cola (UUID generado en el cliente). */
  id: string;
  /**
   * El reporte al que se refiere: lo que va en la ruta (`PUT /reportes/:id`, `PATCH …/cierre`) y
   * es la clave de idempotencia (OFF-05). En un inicio lo genera el cliente; en un cierre es el
   * del inicio que se cierra. Va aparte de `id` para que un inicio y su cierre pendientes a la
   * vez no choquen en la cola.
   */
  reporteId: string;
  tipoServicio: TipoServicio;
  accion: AccionAviso;
  /** Hora real del evento, no la del envío (OFF-03). */
  ocurridoEn: FechaIso;
  estado: EstadoAviso;
  /** Solo en `error`: el código que explica el rechazo. */
  codigoError?: CodigoError;
}

export type NuevoAviso = Omit<AvisoCola, 'estado' | 'codigoError'>;

// ─── Conexión (PWA.md §7) ────────────────────────────────────────────────────────────────────

export type ModoConexion = 'en-linea' | 'sin-conexion' | 'servidor-caido';

export interface EstadoConexion {
  modo: ModoConexion;
  /** Última vez que una petición salió bien; nulo si nunca (primera carga sin red). */
  ultimaSincronizacion: FechaIso | null;
}

// ─── Sesión ──────────────────────────────────────────────────────────────────────────────────

export interface UsuarioSesion {
  /** El `sub` del JWT de Supabase: es el id del residente. */
  id: string;
  correo: string;
}
