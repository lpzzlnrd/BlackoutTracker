import { describe, expect, it, vi } from 'vitest';
import { cargarPuertosDemo } from '../datos/adaptadores/mock/cargar';
import { vigilarConexion } from './vigilar-conexion';

const sinEsperar = () => Promise.resolve();

describe('vigilarConexion', () => {
  it('con red al arrancar sincroniza una vez y no sondea', async () => {
    const p = await cargarPuertosDemo({ escenario: 'en-linea' });
    const sondear = vi.spyOn(p.sondaSalud, 'sondear');
    const sincronizar = vi.fn(async () => undefined);
    const parar = vigilarConexion({ puertos: p, sincronizar, esperar: sinEsperar });
    expect(sincronizar).toHaveBeenCalledTimes(1);
    expect(sondear).not.toHaveBeenCalled();
    parar();
  });

  it('OFF-02: sin red sondea con espera creciente y, al primer ok, declara la vuelta y sincroniza', async () => {
    const p = await cargarPuertosDemo({ escenario: 'sin-conexion' });
    const esperas: number[] = [];
    let intentos = 0;
    p.sondaSalud.sondear = async () => (intentos += 1) >= 3; // falla dos veces, acierta a la tercera
    const sincronizar = vi.fn(async () => undefined);

    vigilarConexion({
      puertos: p,
      sincronizar,
      esperasMs: [10, 20, 40],
      esperar: async (ms) => void esperas.push(ms),
    });

    await vi.waitFor(() => expect(sincronizar).toHaveBeenCalledTimes(1));
    expect(esperas).toEqual([10, 20, 40]);
    expect(p.conexion.leer()).toEqual({ modo: 'en-linea', ultimaSincronizacion: p.reloj.ahora() });
  });

  it('el evento online corta la espera del sondeo y comprueba al instante', async () => {
    const p = await cargarPuertosDemo({ escenario: 'sin-conexion' });
    let hayServidor = false;
    p.sondaSalud.sondear = async () => hayServidor;
    const objetivo = new EventTarget();
    const sincronizar = vi.fn(async () => undefined);
    // Una espera que nunca termina por sí sola: solo el evento puede adelantarla.
    const esperar = vi.fn(() => new Promise<void>(() => undefined));

    vigilarConexion({ puertos: p, sincronizar, objetivo, esperar });
    await vi.waitFor(() => expect(esperar).toHaveBeenCalledTimes(1));
    expect(sincronizar).not.toHaveBeenCalled();

    hayServidor = true;
    objetivo.dispatchEvent(new Event('online'));
    await vi.waitFor(() => expect(sincronizar).toHaveBeenCalledTimes(1));
  });

  it('al detenerla ya no sondea ni sincroniza', async () => {
    const p = await cargarPuertosDemo({ escenario: 'sin-conexion' });
    let permitir = false;
    p.sondaSalud.sondear = async () => permitir;
    const sincronizar = vi.fn(async () => undefined);
    const parar = vigilarConexion({ puertos: p, sincronizar, esperar: sinEsperar });
    parar();
    permitir = true;
    await new Promise((r) => setTimeout(r, 20));
    expect(sincronizar).not.toHaveBeenCalled();
  });
});
