import type { ReporteDto } from '@blackout/shared';
import { describe, expect, it } from 'vitest';
import type { AvisoCola } from '../dominio/tipos';
import { corteAbierto } from './corte-abierto';

const reporte = (
  id: string,
  tipoServicio: 'agua' | 'electricidad',
  inicioEn: string,
  finEn: string | null = null,
): ReporteDto => ({
  id,
  tipoServicio,
  sectorId: 1,
  inicioEn,
  finEn,
  duracionMin: null,
  recibidoEn: inicioEn,
});

const aviso = (
  parcial: Pick<AvisoCola, 'reporteId' | 'tipoServicio' | 'accion' | 'ocurridoEn'> &
    Partial<AvisoCola>,
): AvisoCola => ({ id: `${parcial.reporteId}-${parcial.accion}`, estado: 'pendiente', ...parcial });

describe('corteAbierto', () => {
  it('sin reportes ni cola no hay corte abierto', () => {
    expect(corteAbierto('electricidad', [], [])).toBeNull();
    expect(corteAbierto('electricidad', undefined, undefined)).toBeNull();
  });

  it('REP-05: el abierto del servidor es el que se cierra (no se abre otro del mismo servicio)', () => {
    const abierto = corteAbierto('agua', [reporte('a1', 'agua', '2026-10-07T12:00:00Z')], []);
    expect(abierto).toEqual({ reporteId: 'a1', inicioEn: '2026-10-07T12:00:00Z' });
  });

  it('REP-06: agua y luz no se mezclan', () => {
    const servidor = [reporte('a1', 'agua', '2026-10-07T12:00:00Z')];
    expect(corteAbierto('electricidad', servidor, [])).toBeNull();
    expect(corteAbierto('agua', servidor, [])?.reporteId).toBe('a1');
  });

  it('los reportes cerrados del servidor no cuentan', () => {
    const servidor = [reporte('a1', 'agua', '2026-10-07T12:00:00Z', '2026-10-07T14:00:00Z')];
    expect(corteAbierto('agua', servidor, [])).toBeNull();
  });

  it('OFF-01: un inicio pendiente en la cola ya cuenta como abierto, sin red', () => {
    const cola = [
      aviso({
        reporteId: 'r1',
        tipoServicio: 'electricidad',
        accion: 'inicio',
        ocurridoEn: '2026-10-07T18:00:00Z',
      }),
    ];
    expect(corteAbierto('electricidad', undefined, cola)).toEqual({
      reporteId: 'r1',
      inicioEn: '2026-10-07T18:00:00Z',
    });
  });

  it('OFF-04: un cierre en cola cierra su corte aunque el servidor aún lo vea abierto', () => {
    const servidor = [reporte('r1', 'electricidad', '2026-10-07T18:00:00Z')];
    const cola = [
      aviso({
        reporteId: 'r1',
        tipoServicio: 'electricidad',
        accion: 'cierre',
        ocurridoEn: '2026-10-07T19:00:00Z',
      }),
    ];
    expect(corteAbierto('electricidad', servidor, cola)).toBeNull();
  });

  it('OFF-04: inicio y cierre en cola a la vez dejan el ciclo cerrado', () => {
    const cola = [
      aviso({
        reporteId: 'r1',
        tipoServicio: 'agua',
        accion: 'inicio',
        ocurridoEn: '2026-10-07T10:00:00Z',
      }),
      aviso({
        reporteId: 'r1',
        tipoServicio: 'agua',
        accion: 'cierre',
        ocurridoEn: '2026-10-07T11:00:00Z',
        estado: 'enviado',
      }),
    ];
    expect(corteAbierto('agua', [], cola)).toBeNull();
  });

  it('un aviso rechazado (error) no abre ni cierra nada', () => {
    const servidor = [reporte('r1', 'agua', '2026-10-07T10:00:00Z')];
    const cola = [
      aviso({
        reporteId: 'r1',
        tipoServicio: 'agua',
        accion: 'cierre',
        ocurridoEn: '2026-10-07T09:00:00Z',
        estado: 'error',
      }),
      aviso({
        reporteId: 'r2',
        tipoServicio: 'agua',
        accion: 'inicio',
        ocurridoEn: '2026-10-07T12:00:00Z',
        estado: 'error',
      }),
    ];
    expect(corteAbierto('agua', servidor, cola)?.reporteId).toBe('r1');
  });

  it('si por un desfase hubiera dos abiertos, gana el más reciente', () => {
    const servidor = [reporte('viejo', 'agua', '2026-10-06T10:00:00Z')];
    const cola = [
      aviso({
        reporteId: 'nuevo',
        tipoServicio: 'agua',
        accion: 'inicio',
        ocurridoEn: '2026-10-07T10:00:00Z',
        estado: 'enviado',
      }),
    ];
    expect(corteAbierto('agua', servidor, cola)?.reporteId).toBe('nuevo');
  });
});
