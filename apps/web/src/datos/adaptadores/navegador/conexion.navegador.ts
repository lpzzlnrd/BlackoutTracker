import { crearAlmacen } from '../../../dominio/observable';
import type { EstadoConexion } from '../../../dominio/tipos';
import type { Conexion } from '../../puertos';

/**
 * Estado de la red en el navegador. Parte de `navigator.onLine`, pero no se fía de él para
 * declararse en línea: solo una petición buena (`registrarExito`) vuelve a `en-linea`. El evento
 * `offline`, en cambio, sí es una señal fiable de que no hay red.
 *
 * La última sincronización queda en memoria; que sobreviva al cierre del navegador es cosa de la
 * persistencia de la caché de consultas (PWA.md §7).
 */
export function crearConexionNavegador(opciones: {
  /** Hora de la última sincronización conocida, si la caché persistida la trae. */
  ultimaSincronizacion?: string | null;
  objetivo?: EventTarget;
  enLinea?: () => boolean;
}): Conexion {
  const objetivo = opciones.objetivo ?? globalThis;
  const hayRed = opciones.enLinea ?? (() => navigator.onLine);

  const estado = crearAlmacen<EstadoConexion>({
    modo: hayRed() ? 'en-linea' : 'sin-conexion',
    ultimaSincronizacion: opciones.ultimaSincronizacion ?? null,
  });

  objetivo.addEventListener('offline', () => {
    estado.fijar({ ...estado.leer(), modo: 'sin-conexion' });
  });

  return {
    leer: estado.leer,
    suscribir: estado.suscribir,
    registrarExito: (en) => estado.fijar({ modo: 'en-linea', ultimaSincronizacion: en }),
    registrarFallo: (causa) =>
      estado.fijar({
        ...estado.leer(),
        modo: causa === 'red' ? 'sin-conexion' : 'servidor-caido',
      }),
  };
}
