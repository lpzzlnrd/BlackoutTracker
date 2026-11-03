import type {
  CerrarReporteSolicitud,
  CrearResidenteSolicitud,
  EstimacionDto,
  HistorialDto,
  IniciarReporteSolicitud,
  PinValidadoDto,
  ReporteDto,
  ResumenSectorDto,
  SectorAsignadoDto,
  SectoresGeoJsonDto,
  TipoServicio,
  ValidarPinSolicitud,
  ZonaDto,
} from '@blackout/shared';

// Un puerto por recurso de la API (PLAN.md §5). Todos devuelven los DTO de `@blackout/shared` y
// fallan con `ErrorApiCliente`. Ninguno devuelve coordenadas de residentes (NF-06).

/** `GET /sectores` (VIS-01) y `GET /zona` (D-040). */
export interface RepositorioSectores {
  /** Los hexágonos que ya tienen vecinos. */
  obtenerGeoJson(): Promise<SectoresGeoJsonDto>;
  /** El contorno de la Gran Valencia, simplificado: la máscara y el aviso inmediato del pin. */
  obtenerZona(): Promise<ZonaDto>;
}

/** Registro y perfil del residente (REG-*). */
export interface RepositorioResidente {
  /**
   * `POST /registro/validar-pin`: el sector (hexágono) en el que quedaría el pin; `sectorId` es
   * `null` si nadie se ha registrado aún en esa celda. 422 `PIN_FUERA_DE_ZONA` fuera de la zona.
   */
  validarPin(pin: ValidarPinSolicitud): Promise<PinValidadoDto>;
  /** `POST /residentes/me`. 409 si ya existe. */
  crear(pin: CrearResidenteSolicitud): Promise<SectorAsignadoDto>;
  /** `GET /residentes/me`. 403 `REGISTRO_INCOMPLETO` si hay cuenta sin perfil. */
  obtenerMio(): Promise<SectorAsignadoDto>;
}

/** Escritura de reportes, idempotente por `id` (OFF-05). */
export interface RepositorioReportes {
  /** `PUT /reportes/:id`. */
  iniciar(id: string, solicitud: IniciarReporteSolicitud): Promise<ReporteDto>;
  /** `PATCH /reportes/:id/cierre`. */
  cerrar(id: string, solicitud: CerrarReporteSolicitud): Promise<ReporteDto>;
  /** `GET /reportes/mios`. */
  obtenerMios(opciones?: { abiertos?: boolean }): Promise<ReporteDto[]>;
}

/** `GET /estimaciones` (EST-*). */
export interface RepositorioEstimaciones {
  obtener(sectorId: number, tipoServicio: TipoServicio): Promise<EstimacionDto>;
}

/** Detalle de un sector: resumen (VIS-04) e historial paginado. */
export interface RepositorioDetalleSector {
  /** `GET /sectores/:id/resumen`. */
  resumen(sectorId: number): Promise<ResumenSectorDto>;
  /** `GET /sectores/:id/historial`. Solo eventos cerrados. */
  historial(
    sectorId: number,
    opciones?: { tipoServicio?: TipoServicio; cursor?: string },
  ): Promise<HistorialDto>;
}
