import type { FechaIso } from '@blackout/shared';
import { crearAlmacen } from '../../../dominio/observable';
import type { EstadoConexion, ModoConexion } from '../../../dominio/tipos';
import type { Conexion, SondaSalud } from '../../puertos';

export interface ConexionMock extends Conexion {
  /** Simula perder o recuperar la red (el botón de la demo, o un test de reconexión). */
  fijarModo(modo: ModoConexion): void;
}

export function crearConexionMock(inicial: EstadoConexion): ConexionMock {
  const estado = crearAlmacen<EstadoConexion>(inicial);
  return {
    leer: estado.leer,
    suscribir: estado.suscribir,
    registrarExito(en: FechaIso) {
      estado.fijar({ modo: 'en-linea', ultimaSincronizacion: en });
    },
    registrarFallo(causa) {
      estado.fijar({
        ...estado.leer(),
        modo: causa === 'red' ? 'sin-conexion' : 'servidor-caido',
      });
    },
    fijarModo(modo) {
      estado.fijar({ ...estado.leer(), modo });
    },
  };
}

/** El servidor "responde" mientras la red no esté caída. */
export function crearSondaSaludMock(conexion: Conexion): SondaSalud {
  return { sondear: async () => conexion.leer().modo === 'en-linea' };
}
