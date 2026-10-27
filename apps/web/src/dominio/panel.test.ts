import { EstadoServicio, TipoServicio } from '@blackout/shared';
import { describe, expect, it } from 'vitest';
import { filasPanel, intervalo, leerSectorId, lineaEstado, recuentoPorEstado } from './panel';
import type { EstadoSector } from './tipos';

const SECTORES = [1, 2, 3, 4].map((id) => ({ id, nombre: `Sector ${id}` }));
const AHORA = '2026-10-07T19:06:00Z';

const fila = (
  sectorId: number,
  tipoServicio: TipoServicio,
  cambios: Partial<EstadoSector> = {},
): EstadoSector => ({
  sectorId,
  tipoServicio,
  estado: EstadoServicio.ConServicio,
  reportesSinConfirmar: 0,
  desde: null,
  actualizadoEn: AHORA,
  ...cambios,
});

const ESTADOS: EstadoSector[] = [
  fila(1, TipoServicio.Electricidad),
  fila(2, TipoServicio.Electricidad, { reportesSinConfirmar: 2 }),
  fila(3, TipoServicio.Electricidad, {
    estado: EstadoServicio.SinServicio,
    desde: '2026-10-07T18:20:00Z',
  }),
  fila(4, TipoServicio.Electricidad),
  fila(1, TipoServicio.Agua),
  fila(2, TipoServicio.Agua),
  fila(3, TipoServicio.Agua),
  fila(4, TipoServicio.Agua, { estado: EstadoServicio.SinServicio, desde: AHORA }),
];

describe('filasPanel', () => {
  it('VIS-02: el filtro "agua" solo marca los sectores sin agua', () => {
    const filas = filasPanel(SECTORES, ESTADOS, TipoServicio.Agua);
    expect(filas.filter((f) => f.estado === 'sin-servicio').map((f) => f.sectorId)).toEqual([4]);
    expect(filas.every((f) => f.fila?.tipoServicio === TipoServicio.Agua)).toBe(true);
  });

  it('VIS-02: ordena del peor estado al mejor y, a igual estado, por número de sector', () => {
    const filas = filasPanel(SECTORES, ESTADOS, TipoServicio.Electricidad);
    expect(filas.map((f) => f.sectorId)).toEqual([3, 2, 1, 4]);
  });

  it('VIS-02: el sector propio va primero aunque tenga servicio', () => {
    const filas = filasPanel(SECTORES, ESTADOS, TipoServicio.Electricidad, 4);
    expect(filas.map((f) => f.sectorId)).toEqual([4, 3, 2, 1]);
    expect(filas[0]?.propio).toBe(true);
    expect(filas.filter((f) => f.propio)).toHaveLength(1);
  });

  it('VIS-02: sin estados guardados (primera carga sin red) todos quedan "sin datos"', () => {
    const filas = filasPanel(SECTORES, undefined, TipoServicio.Electricidad);
    expect(filas.map((f) => f.estado)).toEqual(Array(4).fill('sin-datos'));
  });
});

describe('recuentoPorEstado', () => {
  it('VIS-02: cuenta por estado en el orden de la leyenda y omite los que no aparecen', () => {
    const filas = filasPanel(SECTORES, ESTADOS, TipoServicio.Electricidad);
    expect(recuentoPorEstado(filas)).toEqual([
      ['sin-servicio', 1],
      ['sin-confirmar', 1],
      ['con-servicio', 2],
    ]);
  });
});

describe('lineaEstado', () => {
  it('VIS-04: sin servicio dice desde qué hora, en hora de Caracas', () => {
    expect(lineaEstado(ESTADOS[2], 3)).toBe('Desde las 14:20');
  });

  it('CON-01: con N − 1 reportes muestra "2 de 3 reportes" sin cambiar el estado', () => {
    expect(lineaEstado(ESTADOS[1], 3)).toBe('2 de 3 reportes');
  });

  it('VIS-04: con servicio y sin reportes, o sin datos, no hay línea', () => {
    expect(lineaEstado(ESTADOS[0], 3)).toBeNull();
    expect(lineaEstado(undefined, 3)).toBeNull();
  });
});

describe('intervalo', () => {
  it('VIS-04: "09:10 a 12:40" para un corte cerrado; "Desde las …" para uno en curso', () => {
    expect(intervalo({ inicioEn: '2026-10-07T13:10:00Z', finEn: '2026-10-07T16:40:00Z' })).toBe(
      '09:10 a 12:40',
    );
    expect(intervalo({ inicioEn: '2026-10-07T18:20:00Z', finEn: null })).toBe('Desde las 14:20');
  });
});

describe('leerSectorId', () => {
  it('VIS-04: acepta un entero positivo y rechaza lo demás', () => {
    expect(leerSectorId('2')).toBe(2);
    for (const malo of [null, '', '0', '-1', '1.5', 'abc', '2x']) {
      expect(leerSectorId(malo)).toBeNull();
    }
  });
});
