import type { ColaAvisos } from './cola-avisos';
import type { Conexion, SondaSalud } from './conexion';
import type { Configuracion } from './configuracion';
import type { EstadosSector } from './estados-sector';
import type { Reloj } from './reloj';
import type {
  RepositorioDetalleSector,
  RepositorioEstimaciones,
  RepositorioReportes,
  RepositorioResidente,
  RepositorioSectores,
} from './repositorios';
import type { Sesion } from './sesion';

export type { ColaAvisos } from './cola-avisos';
export type { Conexion, SondaSalud } from './conexion';
export type { Configuracion } from './configuracion';
export type { EstadosSector } from './estados-sector';
export type { Reloj } from './reloj';
export type {
  RepositorioDetalleSector,
  RepositorioEstimaciones,
  RepositorioReportes,
  RepositorioResidente,
  RepositorioSectores,
} from './repositorios';
export type { Sesion } from './sesion';

/**
 * Todo lo que la app necesita del exterior. La interfaz y los casos de uso reciben esto y nada
 * más: no saben si detrás hay la API real, Dexie y Supabase, o el modo demo.
 */
export interface Puertos {
  reloj: Reloj;
  conexion: Conexion;
  sondaSalud: SondaSalud;
  configuracion: Configuracion;
  sesion: Sesion;
  sectores: RepositorioSectores;
  residente: RepositorioResidente;
  reportes: RepositorioReportes;
  estimaciones: RepositorioEstimaciones;
  detalleSector: RepositorioDetalleSector;
  estadosSector: EstadosSector;
  colaAvisos: ColaAvisos;
}
