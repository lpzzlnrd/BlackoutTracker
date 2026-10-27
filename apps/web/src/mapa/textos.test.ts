import { EstadoServicio, OrigenEvento, TipoServicio, type EventoSectorDto } from '@blackout/shared';
import { describe, expect, it } from 'vitest';
import type { AvisoCola, EstadoSector } from '../dominio/tipos';
import {
  anunciosDeCambio,
  estadoDeSector,
  etiquetaMapa,
  intervaloCorte,
  lineaEstado,
  textoAvisoPendiente,
  textoBotonPrincipal,
} from './textos';

const AHORA = '2026-10-07T19:06:00Z'; // 15:06 en Caracas
const { Electricidad: LUZ, Agua: AGUA } = TipoServicio;

const fila = (
  sectorId: number,
  tipoServicio: TipoServicio,
  estado: EstadoServicio,
  reportesSinConfirmar = 0,
  desde: string | null = null,
): EstadoSector => ({
  sectorId,
  tipoServicio,
  estado,
  reportesSinConfirmar,
  desde,
  actualizadoEn: AHORA,
});

const evento = (inicioEn: string, finEn: string | null, duracionMin: number | null = null) =>
  ({
    id: 1,
    sectorId: 1,
    tipoServicio: LUZ,
    inicioEn,
    finEn,
    duracionMin,
    confirmadoEn: inicioEn,
    origen: OrigenEvento.Consenso,
  }) satisfies EventoSectorDto;

const SECTORES = [1, 2, 3, 4].map((id) => ({ id, nombre: `Sector ${id}` }));
const ESTADOS = [
  fila(1, LUZ, EstadoServicio.SinServicio, 0, '2026-10-07T18:20:00Z'),
  fila(2, LUZ, EstadoServicio.ConServicio),
  fila(3, LUZ, EstadoServicio.ConServicio, 2),
  fila(4, LUZ, EstadoServicio.ConServicio),
  fila(1, AGUA, EstadoServicio.ConServicio),
];

describe('estado de cada sector en el mapa', () => {
  it('VIS-01: solo los sectores confirmados salen "sin servicio"; el resto, con su estado', () => {
    expect(SECTORES.map((s) => estadoDeSector(ESTADOS, s.id, LUZ))).toEqual([
      'sin-servicio',
      'con-servicio',
      'sin-confirmar',
      'con-servicio',
    ]);
  });

  it('VIS-02: agua y luz se dibujan por separado', () => {
    expect(estadoDeSector(ESTADOS, 1, AGUA)).toBe('con-servicio');
    expect(estadoDeSector(ESTADOS, 1, LUZ)).toBe('sin-servicio');
  });

  it('OFF-07: sin filas guardadas (primera carga sin red) el sector queda "sin datos"', () => {
    expect(estadoDeSector(undefined, 1, LUZ)).toBe('sin-datos');
    expect(estadoDeSector(ESTADOS, 2, AGUA)).toBe('sin-datos');
  });
});

describe('etiquetaMapa', () => {
  it('VIS-01: describe cada sector como la maqueta (CANON §4.6)', () => {
    expect(etiquetaMapa(SECTORES, ESTADOS, LUZ)).toBe(
      'Mapa de sectores: Sector 1 sin servicio, Sector 2 con servicio, Sector 3 con reportes sin confirmar, Sector 4 con servicio',
    );
  });

  it('VIS-01: sin sectores todavía, solo "Mapa de sectores"', () => {
    expect(etiquetaMapa([], ESTADOS, LUZ)).toBe('Mapa de sectores');
  });
});

describe('anunciosDeCambio', () => {
  const nombre = (id: number) => `Sector ${id}`;

  it('VIS-03: anuncia el cambio que llega por Realtime ("Sector 2: sin servicio eléctrico")', () => {
    const actuales = ESTADOS.map((f) =>
      f.sectorId === 2 && f.tipoServicio === LUZ ? { ...f, estado: EstadoServicio.SinServicio } : f,
    );
    expect(anunciosDeCambio(ESTADOS, actuales, nombre)).toEqual([
      'Sector 2: sin servicio eléctrico',
    ]);
  });

  it('VIS-03: el restablecimiento y los reportes sin confirmar también se anuncian', () => {
    const actuales = [
      { ...ESTADOS[0]!, estado: EstadoServicio.ConServicio },
      { ...ESTADOS[4]!, reportesSinConfirmar: 1 },
    ];
    expect(anunciosDeCambio(ESTADOS, actuales, nombre)).toEqual([
      'Sector 1: volvió el servicio eléctrico',
      'Sector 1: reportes sin confirmar de agua',
    ]);
  });

  it('VIS-03: la primera carga y lo que no cambió no se anuncian', () => {
    expect(anunciosDeCambio(undefined, ESTADOS, nombre)).toEqual([]);
    const otraHora = ESTADOS.map((f) => ({ ...f, actualizadoEn: '2026-10-07T19:10:00Z' }));
    expect(anunciosDeCambio(ESTADOS, otraHora, nombre)).toEqual([]);
  });
});

describe('lineaEstado', () => {
  it('VIS-04: sin servicio, "Desde las {hora}" en hora de Caracas', () => {
    expect(
      lineaEstado({
        estado: 'sin-servicio',
        fila: ESTADOS[0],
        eventos: [],
        consensoN: 3,
        ahora: AHORA,
      }),
    ).toBe('Desde las 14:20');
  });

  it('CON-01: con N − 1 reportes, "2 de 3 reportes"', () => {
    expect(
      lineaEstado({
        estado: 'sin-confirmar',
        fila: ESTADOS[2],
        eventos: [],
        consensoN: 3,
        ahora: AHORA,
      }),
    ).toBe('2 de 3 reportes');
  });

  it('VIS-04: con servicio, la última interrupción cerrada (se salta la que sigue en curso)', () => {
    expect(
      lineaEstado({
        estado: 'con-servicio',
        fila: ESTADOS[1],
        eventos: [
          evento('2026-10-07T17:00:00Z', null),
          evento('2026-10-05T13:10:00Z', '2026-10-05T18:10:00Z', 300),
        ],
        consensoN: 3,
        ahora: AHORA,
      }),
    ).toBe('Última interrupción: hace 2 días, duró 5 h');
  });

  it('VIS-04: con servicio y sin cortes cerrados, lo dice en vez de inventar', () => {
    expect(
      lineaEstado({
        estado: 'con-servicio',
        fila: ESTADOS[1],
        eventos: [],
        consensoN: 3,
        ahora: AHORA,
      }),
    ).toBe('Sin interrupciones registradas');
  });
});

describe('textos de acción', () => {
  it('REP-01/REP-03: el botón depende del estado del sector (CANON §7.1)', () => {
    expect(textoBotonPrincipal('sin-servicio', LUZ)).toBe('Ya volvió la luz');
    expect(textoBotonPrincipal('con-servicio', AGUA)).toBe('Se fue el agua');
    expect(textoBotonPrincipal('sin-confirmar', LUZ)).toBe('Se fue la luz');
  });

  it('OFF-01: el aviso pendiente se nombra con su acción y su hora real', () => {
    const aviso: AvisoCola = {
      id: 'a',
      reporteId: 'r',
      tipoServicio: LUZ,
      accion: 'cierre',
      ocurridoEn: '2026-10-07T19:04:00Z',
      estado: 'pendiente',
    };
    expect(textoAvisoPendiente(aviso)).toBe(
      'Tu aviso «Volvió la luz» (15:04) está pendiente de envío',
    );
  });

  it('VIS-04: intervalo del corte cerrado y del que sigue en curso', () => {
    expect(intervaloCorte(evento('2026-10-06T13:10:00Z', '2026-10-06T16:40:00Z'))).toBe(
      '09:10 a 12:40',
    );
    expect(intervaloCorte(evento('2026-10-07T18:20:00Z', null))).toBe('Desde las 14:20');
  });
});
