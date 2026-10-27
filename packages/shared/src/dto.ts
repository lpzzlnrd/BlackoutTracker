import type { EstadoServicio, OrigenEvento, TipoServicio } from './enums';

// Interfaces de las solicitudes y respuestas de la API (docs/PLAN.md §5). Los DTO con
// class-validator viven en apps/api y las implementan; así el frontend no arrastra class-validator.
// Los nombres de los campos van en camelCase. La única excepción es `EstadoSectorFila`, que es la
// fila de la tabla tal como la entrega Supabase al frontend.

/** Fecha y hora en ISO 8601 y UTC, p. ej. `2026-10-07T19:06:00Z`. */
export type FechaIso = string;

// ─── Salud ───────────────────────────────────────────────────────────────────────────────────

/** `GET /salud`. Sirve también de keep-alive de la base de datos. */
export interface SaludDto {
  estado: 'ok' | 'degradado';
  baseDeDatos: 'ok' | 'error';
  hora: FechaIso;
}

// ─── Sectores ────────────────────────────────────────────────────────────────────────────────

/** Geometría de un sector. Las coordenadas son `[lng, lat]`, como en todo GeoJSON. */
export interface GeometriaMultiPoligonoDto {
  type: 'MultiPolygon';
  coordinates: number[][][][];
}

export interface SectorFeatureDto {
  type: 'Feature';
  id: number;
  properties: { id: number; nombre: string };
  geometry: GeometriaMultiPoligonoDto;
}

/** `GET /sectores` (VIS-01). Nunca incluye datos de residentes. */
export interface SectoresGeoJsonDto {
  type: 'FeatureCollection';
  features: SectorFeatureDto[];
}

// ─── Registro y residente ────────────────────────────────────────────────────────────────────

/** El pin que el residente pone sobre su vivienda. Se usa en el registro y nunca sale de la API. */
export interface PinDto {
  lat: number;
  lng: number;
}

/** `POST /registro/validar-pin` (cuerpo). */
export type ValidarPinSolicitud = PinDto;

/** `POST /residentes/me` (cuerpo). */
export type CrearResidenteSolicitud = PinDto;

/**
 * Respuesta de `POST /registro/validar-pin`, de `POST /residentes/me` y de `GET /residentes/me`.
 * Nunca lleva coordenadas (NF-06).
 */
export interface SectorAsignadoDto {
  sectorId: number;
  sectorNombre: string;
}

// ─── Reportes ────────────────────────────────────────────────────────────────────────────────

/** `PUT /reportes/:id` (cuerpo). El `id` va en la ruta y lo genera el cliente (OFF-05). */
export interface IniciarReporteSolicitud {
  tipoServicio: TipoServicio;
  /** Hora real del evento, no la del envío (OFF-03). */
  ocurridoEn: FechaIso;
}

/** `PATCH /reportes/:id/cierre` (cuerpo). */
export interface CerrarReporteSolicitud {
  ocurridoEn: FechaIso;
}

/** Respuesta de `PUT /reportes/:id`, de `PATCH /reportes/:id/cierre` y elemento de `GET /reportes/mios`. */
export interface ReporteDto {
  id: string;
  tipoServicio: TipoServicio;
  sectorId: number;
  inicioEn: FechaIso;
  /** Nulo hasta el cierre. */
  finEn: FechaIso | null;
  /** Minutos entre el inicio y el fin; nulo hasta el cierre. */
  duracionMin: number | null;
  /** Cuándo llegó al servidor; la diferencia con `inicioEn` es el rastro de un envío diferido. */
  recibidoEn: FechaIso;
}

// ─── Eventos y estado de los sectores ────────────────────────────────────────────────────────

/** Un corte confirmado por consenso (o cargado del dataset de campo) en un sector y un servicio. */
export interface EventoSectorDto {
  id: number;
  sectorId: number;
  tipoServicio: TipoServicio;
  inicioEn: FechaIso;
  /** Nulo mientras el corte sigue abierto. */
  finEn: FechaIso | null;
  duracionMin: number | null;
  confirmadoEn: FechaIso;
  origen: OrigenEvento;
}

/**
 * Fila de `estado_sector` tal como la lee el frontend directo de Supabase (por eso va en
 * snake_case). Es lo único que el frontend lee sin pasar por la API.
 */
export interface EstadoSectorFila {
  sector_id: number;
  tipo_servicio: TipoServicio;
  estado: EstadoServicio;
  reportes_sin_confirmar: number;
  evento_id: number | null;
  desde: FechaIso | null;
  actualizado_en: FechaIso;
}

// ─── Estimación estadística ──────────────────────────────────────────────────────────────────

/** Con n a partir del mínimo: la mediana de las duraciones de los cortes cerrados (EST-01 a EST-03). */
export interface EstimacionSuficienteDto {
  suficiente: true;
  /** Cortes cerrados que entran en el cálculo. Siempre se muestra junto a la cifra. */
  n: number;
  medianaMin: number;
  /** Primer y tercer cuartil, para el rango intercuartílico. */
  q1Min?: number;
  q3Min?: number;
}

/** Con n por debajo del mínimo no hay cifra (EST-04). */
export interface EstimacionInsuficienteDto {
  suficiente: false;
  n: number;
}

/** `GET /estimaciones?sectorId&tipoServicio`. */
export type EstimacionDto = EstimacionSuficienteDto | EstimacionInsuficienteDto;

// ─── Resumen e historial de un sector ────────────────────────────────────────────────────────

export interface ResumenServicioDto {
  tipoServicio: TipoServicio;
  estado: EstadoServicio;
  /** Reportes de inicio que todavía no alcanzan el consenso (CON-01). */
  reportesSinConfirmar: number;
  /** Inicio del corte en curso; nulo si hay servicio. */
  desde: FechaIso | null;
  estimacion: EstimacionDto;
  /** Los 5 más recientes, el más nuevo primero. */
  ultimosEventos: EventoSectorDto[];
}

/** `GET /sectores/:id/resumen` (VIS-04): un elemento por servicio. */
export interface ResumenSectorDto {
  sectorId: number;
  sectorNombre: string;
  servicios: ResumenServicioDto[];
}

/** `GET /sectores/:id/historial?tipoServicio&cursor`: eventos cerrados, paginados por cursor. */
export interface HistorialDto {
  eventos: EventoSectorDto[];
  /** Se pasa como `cursor` para pedir la página siguiente; nulo en la última. */
  siguienteCursor: string | null;
}
