import type { EstadoServicio, EstimacionDto, FechaIso, TipoServicio } from '@blackout/shared';
import type { AvisoCola, ConfigCliente } from '../../../dominio/tipos';

export type EscenarioDemo = 'en-linea' | 'sin-conexion';

/** Forma de `docs/frontend/datos-ejemplo.json` (lo que muestran las maquetas). */
export interface DatosEjemplo {
  ahora: FechaIso;
  config: ConfigCliente;
  escenarios: Record<
    EscenarioDemo,
    {
      enLinea: boolean;
      ultimaSincronizacion: FechaIso;
      /** El JSON no trae `reporteId`: ver `normalizarCola`. */
      cola: Omit<AvisoCola, 'reporteId'>[];
    }
  >;
  residente: { sectorId: number };
  sectores: { id: number; nombre: string }[];
  estados: {
    sectorId: number;
    tipoServicio: TipoServicio;
    estado: EstadoServicio;
    reportesSinConfirmar: number;
    desde: FechaIso | null;
  }[];
  estimaciones: ({ sectorId: number; tipoServicio: TipoServicio } & EstimacionDto)[];
  eventos: {
    id: number;
    sectorId: number;
    tipoServicio: TipoServicio;
    inicioEn: FechaIso;
    finEn: FechaIso | null;
  }[];
}

/**
 * El corte de luz del Sector 1 que sigue abierto en los datos de ejemplo (desde las 18:20 UTC).
 * Es el reporte que cierra el aviso pendiente del escenario `sin-conexion`.
 */
export const ID_REPORTE_ABIERTO_DEMO = '5d0c2e7a-3b14-4f8e-8a21-9c6d7e0b4a35';

/** Completa `reporteId`, que el JSON no trae: un cierre apunta al corte abierto de la demo. */
export function normalizarCola(
  cola: DatosEjemplo['escenarios'][EscenarioDemo]['cola'],
): AvisoCola[] {
  return cola.map((aviso) => ({
    ...aviso,
    reporteId: aviso.accion === 'cierre' ? ID_REPORTE_ABIERTO_DEMO : aviso.id,
  }));
}
