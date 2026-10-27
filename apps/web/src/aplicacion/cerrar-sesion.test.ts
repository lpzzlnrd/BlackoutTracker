import { describe, expect, it } from 'vitest';
import { crearColaAvisosMock } from '../datos/adaptadores/mock/cola-avisos.mock';
import { crearSesionMock } from '../datos/adaptadores/mock/sesion.mock';
import type { Sesion } from '../datos/puertos';
import { cerrarSesion } from './cerrar-sesion';

const aviso = {
  id: 'a1',
  reporteId: 'r1',
  tipoServicio: 'electricidad' as const,
  accion: 'inicio' as const,
  ocurridoEn: '2026-10-07T18:00:00Z',
};

describe('cerrarSesion', () => {
  it('REG-07: cierra la sesión y vacía la cola del residente', async () => {
    const sesion = crearSesionMock();
    const colaAvisos = crearColaAvisosMock();
    await colaAvisos.agregar(aviso);

    await cerrarSesion({ sesion, colaAvisos });

    expect(sesion.leer()).toBeNull();
    expect(await colaAvisos.listar()).toEqual([]);
  });

  it('REG-07: si cerrar la sesión falla, la cola queda intacta', async () => {
    const sesion: Sesion = {
      ...crearSesionMock(),
      cerrar: () => Promise.reject(new Error('sin red')),
    };
    const colaAvisos = crearColaAvisosMock();
    await colaAvisos.agregar(aviso);

    await expect(cerrarSesion({ sesion, colaAvisos })).rejects.toThrow('sin red');
    expect(await colaAvisos.listar()).toHaveLength(1);
  });
});
