import type { ReporteDto, SectoresGeoJsonDto, ZonaDto } from '@blackout/shared';
import type { Puertos } from '../../puertos';
import { crearColaAvisosMock } from './cola-avisos.mock';
import { crearConexionMock, crearSondaSaludMock, type ConexionMock } from './conexion.mock';
import { crearConfiguracionMock } from './configuracion.mock';
import { crearRepositorioDetalleSectorMock } from './detalle-sector.mock';
import type { EntornoMock } from './entorno';
import {
  ID_REPORTE_ABIERTO_DEMO,
  normalizarCola,
  type DatosEjemplo,
  type EscenarioDemo,
} from './escenario';
import { crearEstadosSectorMock, type EstadosSectorMock } from './estados-sector.mock';
import { crearRepositorioEstimacionesMock } from './estimaciones.mock';
import { crearRelojMock, type RelojMock } from './reloj.mock';
import { crearRepositorioReportesMock } from './reportes.mock';
import { crearRepositorioResidenteMock } from './residente.mock';
import { crearRepositorioSectoresMock } from './sectores.mock';
import { crearSesionMock, type SesionMock } from './sesion.mock';

/** Los puertos de la demo, más las perillas para manejar el mundo simulado desde fuera. */
export interface PuertosDemo extends Puertos {
  conexion: ConexionMock;
  reloj: RelojMock;
  sesion: SesionMock;
  estadosSector: EstadosSectorMock;
}

export interface OpcionesDemo {
  escenario: EscenarioDemo;
  /** Retardo simulado por llamada (ms). 0 por defecto. */
  latenciaMs?: number;
  /** El vecino tiene cuenta pero todavía no marcó su vivienda (`&vecino=nuevo`). */
  vecinoNuevo?: boolean;
  /**
   * Entra alguien sin cuenta (`&vecino=visitante`, D-041): sin sesión, sin vivienda, sin el corte
   * propio abierto y con la cola vacía. Si crea la cuenta, sigue como un vecino nuevo.
   */
  visitante?: boolean;
}

/**
 * Ensambla todos los mocks sobre un mismo conjunto de datos. Es una función pura de sus
 * argumentos: no lee archivos ni toca la red, así que sirve igual en la demo del navegador y en
 * los tests. Quien carga `datos-ejemplo.json` es `cargar.ts`.
 */
export function crearPuertosDemo(
  datos: DatosEjemplo,
  geoJson: SectoresGeoJsonDto,
  zona: ZonaDto,
  { escenario, latenciaMs = 0, vecinoNuevo = false, visitante = false }: OpcionesDemo,
): PuertosDemo {
  const inicio = datos.escenarios[escenario];
  const reloj = crearRelojMock(datos.ahora);
  const conexion = crearConexionMock({
    modo: inicio.enLinea ? 'en-linea' : 'sin-conexion',
    ultimaSincronizacion: inicio.ultimaSincronizacion,
  });
  const entorno: EntornoMock = { reloj, conexion, latenciaMs };

  const sesion = crearSesionMock(visitante ? null : undefined);
  const sector = datos.sectores.find((s) => s.id === datos.residente.sectorId);
  const residente = crearRepositorioResidenteMock(
    geoJson,
    zona,
    sector && !vecinoNuevo && !visitante
      ? { sectorId: sector.id, sectorNombre: sector.nombre, municipio: 'Valencia' }
      : null,
    entorno,
  );

  // El corte de luz que el vecino ya reportó y que el aviso pendiente cierra (CON-06).
  const corteAbierto = datos.eventos.find((e) => e.finEn === null);
  const semilla: ReporteDto[] =
    corteAbierto && !visitante
      ? [
          {
            id: ID_REPORTE_ABIERTO_DEMO,
            tipoServicio: corteAbierto.tipoServicio,
            sectorId: corteAbierto.sectorId,
            inicioEn: corteAbierto.inicioEn,
            finEn: null,
            duracionMin: null,
            recibidoEn: corteAbierto.inicioEn,
          },
        ]
      : [];

  return {
    reloj,
    conexion,
    sondaSalud: crearSondaSaludMock(conexion),
    configuracion: crearConfiguracionMock(datos.config),
    sesion,
    sectores: crearRepositorioSectoresMock(geoJson, zona, entorno),
    residente,
    reportes: crearRepositorioReportesMock({
      entorno,
      sesion,
      sectorActual: residente.sectorActual,
      semilla,
    }),
    estimaciones: crearRepositorioEstimacionesMock(datos.estimaciones, entorno),
    detalleSector: crearRepositorioDetalleSectorMock(datos, entorno),
    estadosSector: crearEstadosSectorMock(datos.estados, inicio.ultimaSincronizacion, entorno),
    colaAvisos: crearColaAvisosMock(visitante ? [] : normalizarCola(inicio.cola)),
  };
}
