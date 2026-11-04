import type {
  ClavePushDto,
  EstimacionDto,
  HistorialDto,
  PinValidadoDto,
  PreferenciasNotificacionesDto,
  ReporteDto,
  ResumenSectorDto,
  SaludDto,
  SectorAsignadoDto,
  SectoresGeoJsonDto,
  ZonaDto,
} from '@blackout/shared';
import type {
  RepositorioDetalleSector,
  RepositorioEstimaciones,
  RepositorioNotificaciones,
  RepositorioReportes,
  RepositorioResidente,
  RepositorioSectores,
  SondaSalud,
} from '../../puertos';
import type { ClienteHttp } from './cliente';

// Adaptadores de la API real: una llamada por método del puerto, sin lógica propia. Las rutas
// y los cuerpos son los de docs/PLAN.md §5.

export function crearRepositorioSectoresHttp(http: ClienteHttp): RepositorioSectores {
  return {
    obtenerGeoJson: () => http.pedir<SectoresGeoJsonDto>('GET', '/sectores', { conSesion: false }),
    obtenerZona: () => http.pedir<ZonaDto>('GET', '/zona', { conSesion: false }),
  };
}

export function crearRepositorioResidenteHttp(http: ClienteHttp): RepositorioResidente {
  return {
    validarPin: (pin) =>
      http.pedir<PinValidadoDto>('POST', '/registro/validar-pin', {
        cuerpo: pin,
        conSesion: false,
      }),
    crear: (pin) => http.pedir<SectorAsignadoDto>('POST', '/residentes/me', { cuerpo: pin }),
    obtenerMio: () => http.pedir<SectorAsignadoDto>('GET', '/residentes/me'),
  };
}

export function crearRepositorioReportesHttp(http: ClienteHttp): RepositorioReportes {
  return {
    iniciar: (id, solicitud) =>
      http.pedir<ReporteDto>('PUT', `/reportes/${encodeURIComponent(id)}`, { cuerpo: solicitud }),
    cerrar: (id, solicitud) =>
      http.pedir<ReporteDto>('PATCH', `/reportes/${encodeURIComponent(id)}/cierre`, {
        cuerpo: solicitud,
      }),
    obtenerMios: ({ abiertos } = {}) =>
      http.pedir<ReporteDto[]>('GET', '/reportes/mios', { consulta: { abiertos } }),
  };
}

export function crearRepositorioEstimacionesHttp(http: ClienteHttp): RepositorioEstimaciones {
  return {
    obtener: (sectorId, tipoServicio) =>
      http.pedir<EstimacionDto>('GET', '/estimaciones', { consulta: { sectorId, tipoServicio } }),
  };
}

export function crearRepositorioDetalleSectorHttp(http: ClienteHttp): RepositorioDetalleSector {
  return {
    resumen: (sectorId) => http.pedir<ResumenSectorDto>('GET', `/sectores/${sectorId}/resumen`),
    historial: (sectorId, { tipoServicio, cursor } = {}) =>
      http.pedir<HistorialDto>('GET', `/sectores/${sectorId}/historial`, {
        consulta: { tipoServicio, cursor },
      }),
  };
}

/** Notificaciones push (T-072, D-042). La clave pública es lo único que se pide sin sesión. */
export function crearRepositorioNotificacionesHttp(http: ClienteHttp): RepositorioNotificaciones {
  return {
    clave: () => http.pedir<ClavePushDto>('GET', '/notificaciones/clave', { conSesion: false }),
    suscribir: (solicitud) =>
      http.pedir<void>('PUT', '/notificaciones/suscripcion', { cuerpo: solicitud }),
    darDeBaja: (solicitud) =>
      http.pedir<void>('DELETE', '/notificaciones/suscripcion', { cuerpo: solicitud }),
    preferencias: () =>
      http.pedir<PreferenciasNotificacionesDto>('GET', '/notificaciones/preferencias'),
    cambiarPreferencias: (cambios) =>
      http.pedir<PreferenciasNotificacionesDto>('PATCH', '/notificaciones/preferencias', {
        cuerpo: cambios,
      }),
    marcarAbierta: (id) =>
      http.pedir<void>('POST', `/notificaciones/${encodeURIComponent(id)}/abierta`),
  };
}

/** `GET /salud` con `fetch` directo: no pasa por el cliente para no alterar el estado de la conexión. */
export function crearSondaSaludHttp(baseUrl: string, fetchImpl?: typeof fetch): SondaSalud {
  const peticion = fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  return {
    async sondear() {
      try {
        const respuesta = await peticion(`${baseUrl.replace(/\/$/, '')}/salud`, {
          signal: AbortSignal.timeout(5_000),
        });
        if (!respuesta.ok) return false;
        return ((await respuesta.json()) as SaludDto).estado === 'ok';
      } catch {
        return false;
      }
    },
  };
}
