import { CodigoError } from '@blackout/shared';
import { describe, expect, it, vi } from 'vitest';
import { cargarPuertosDemo } from '../datos/adaptadores/mock/cargar';
import type { PuertosDemo } from '../datos/adaptadores/mock/demo';
import { ErrorApiCliente } from '../dominio/errores';
import { crearSincronizador, sincronizarCola } from './sincronizar-cola';

const AHORA = Date.parse('2026-10-07T19:06:00Z');
const hace = (min: number) => new Date(AHORA - min * 60_000).toISOString();

const inicio = (id: string, tipoServicio: 'agua' | 'electricidad', ocurridoEn: string) => ({
  id,
  reporteId: id,
  tipoServicio,
  accion: 'inicio' as const,
  ocurridoEn,
});

async function sinConexion(): Promise<PuertosDemo> {
  return cargarPuertosDemo({ escenario: 'sin-conexion' });
}

describe('sincronizarCola', () => {
  it('OFF-01: sin red no envía nada, deja los avisos pendientes y se detiene por la red', async () => {
    const p = await sinConexion();
    const r = await sincronizarCola(p);
    expect(r).toEqual({ enviados: 0, rechazados: 0, detenidoPor: 'red' });
    expect((await p.colaAvisos.listar()).map((a) => a.estado)).toEqual(['pendiente']);
    // El fallo de red quedó anotado: la franja de "sin conexión" no se pierde.
    expect(p.conexion.leer().modo).toBe('sin-conexion');
  });

  it('CON-06: al volver la red envía el cierre pendiente de la demo y calcula la duración', async () => {
    const p = await sinConexion();
    p.conexion.fijarModo('en-linea');
    const r = await sincronizarCola(p);
    expect(r).toEqual({ enviados: 1, rechazados: 0 });
    expect((await p.colaAvisos.listar())[0]?.estado).toBe('enviado');
    // 18:20 → 19:04 UTC.
    expect((await p.reportes.obtenerMios())[0]).toMatchObject({ duracionMin: 44 });
    // Una petición buena actualiza la hora de la última sincronización.
    expect(p.conexion.leer().ultimaSincronizacion).toBe(p.reloj.ahora());
  });

  it('OFF-04: envía en orden cronológico de ocurridoEn, no de llegada', async () => {
    const p = await sinConexion();
    p.conexion.fijarModo('en-linea');
    await p.colaAvisos.vaciar();
    await p.colaAvisos.agregar(inicio('tarde', 'agua', hace(10)));
    await p.colaAvisos.agregar(inicio('temprano', 'agua', hace(60)));
    const orden: string[] = [];
    const real = p.reportes.iniciar.bind(p.reportes);
    p.reportes.iniciar = async (id, s) => {
      orden.push(id);
      return real(id, s);
    };
    await sincronizarCola(p);
    // El segundo es un duplicado de servicio abierto (REP-05): llega y se rechaza, pero en orden.
    expect(orden).toEqual(['temprano', 'tarde']);
  });

  it('OFF-05: si la conexión se corta a mitad del envío, el reintento no duplica el reporte', async () => {
    const p = await sinConexion();
    p.conexion.fijarModo('en-linea');
    await p.colaAvisos.vaciar();
    await p.colaAvisos.agregar(inicio('r-agua', 'agua', hace(30)));

    // El servidor recibe y guarda, pero la respuesta se pierde.
    const real = p.reportes.iniciar.bind(p.reportes);
    let primera = true;
    p.reportes.iniciar = async (id, s) => {
      const reporte = await real(id, s);
      if (primera) {
        primera = false;
        throw new ErrorApiCliente(0);
      }
      return reporte;
    };

    expect(await sincronizarCola(p)).toMatchObject({ enviados: 0, detenidoPor: 'red' });
    expect((await p.colaAvisos.listar())[0]?.estado).toBe('pendiente');

    p.conexion.fijarModo('en-linea');
    expect(await sincronizarCola(p)).toEqual({ enviados: 1, rechazados: 0 });
    const agua = (await p.reportes.obtenerMios()).filter((r) => r.tipoServicio === 'agua');
    expect(agua).toHaveLength(1);
  });

  it('un rechazo permanente se marca error con su código y no frena al resto', async () => {
    const p = await sinConexion();
    p.conexion.fijarModo('en-linea');
    await p.colaAvisos.vaciar();
    // Hora futura: 422 HORA_INVALIDA. Luego uno válido.
    await p.colaAvisos.agregar(inicio('futuro', 'agua', hace(-30)));
    await p.colaAvisos.agregar(inicio('bueno', 'agua', hace(5)));

    // Se envían en orden de ocurridoEn: primero el válido (hace 5 min) y luego el futuro.
    const r = await sincronizarCola(p);
    expect(r).toEqual({ enviados: 1, rechazados: 1 });
    const cola = await p.colaAvisos.listar();
    expect(cola.find((a) => a.id === 'futuro')).toMatchObject({
      estado: 'error',
      codigoError: CodigoError.HoraInvalida,
    });
    expect(cola.find((a) => a.id === 'bueno')?.estado).toBe('enviado');
  });

  it('un cierre cuyo inicio aún no llega (404) se reintenta y detiene la cola sin marcar error', async () => {
    const p = await sinConexion();
    p.conexion.fijarModo('en-linea');
    await p.colaAvisos.vaciar();
    await p.colaAvisos.agregar({
      id: 'c1',
      reporteId: 'inicio-que-no-llega',
      tipoServicio: 'agua',
      accion: 'cierre',
      ocurridoEn: hace(5),
    });
    const r = await sincronizarCola(p);
    expect(r.detenidoPor).toBe('inicio-pendiente');
    expect((await p.colaAvisos.listar())[0]?.estado).toBe('pendiente');
  });

  it('401 sin poder renovar la sesión: se detiene por la sesión y conserva la cola', async () => {
    const p = await sinConexion();
    p.conexion.fijarModo('en-linea');
    p.sesion.vencer({ renovable: false });
    const r = await sincronizarCola(p);
    expect(r.detenidoPor).toBe('sesion');
    expect((await p.colaAvisos.listar())[0]?.estado).toBe('pendiente');
  });

  it('un error que no es de la API no se traga: se propaga', async () => {
    const p = await sinConexion();
    p.conexion.fijarModo('en-linea');
    p.reportes.cerrar = async () => {
      throw new TypeError('bug');
    };
    await expect(sincronizarCola(p)).rejects.toThrow('bug');
  });
});

describe('crearSincronizador', () => {
  it('dos disparos a la vez comparten una sola pasada (no envían en paralelo)', async () => {
    const p = await sinConexion();
    p.conexion.fijarModo('en-linea');
    const cerrar = vi.spyOn(p.reportes, 'cerrar');
    const sincronizar = crearSincronizador(p);

    const [a, b] = await Promise.all([sincronizar(), sincronizar()]);
    expect(a).toBe(b);
    expect(cerrar).toHaveBeenCalledTimes(1);

    // Terminada la pasada, un nuevo disparo vuelve a ejecutarse.
    await sincronizar();
    expect(cerrar).toHaveBeenCalledTimes(1); // ya no quedan pendientes: no hay nada que enviar
  });
});
