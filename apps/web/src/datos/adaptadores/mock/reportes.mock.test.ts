import { describe, expect, it } from 'vitest';
import { cargarPuertosDemo } from './cargar';
import type { PuertosDemo } from './demo';
import { crearRepositorioReportesMock } from './reportes.mock';

const AHORA = '2026-10-07T19:06:00.000Z';
const hace = (min: number) => new Date(Date.parse(AHORA) - min * 60_000).toISOString();

async function nueva(): Promise<PuertosDemo> {
  return cargarPuertosDemo({ escenario: 'en-linea' });
}

describe('mock de reportes: las reglas de PUT /reportes/:id y PATCH …/cierre', () => {
  it('REP-01: el inicio crea el reporte en el sector del residente, con la hora del evento', async () => {
    const p = await nueva();
    const r = await p.reportes.iniciar('r-agua', { tipoServicio: 'agua', ocurridoEn: hace(20) });
    expect(r).toMatchObject({ sectorId: 1, inicioEn: hace(20), finEn: null, duracionMin: null });
  });

  it('OFF-03: recibidoEn es la hora del servidor, distinta de la del evento', async () => {
    const p = await nueva();
    const r = await p.reportes.iniciar('r-agua', { tipoServicio: 'agua', ocurridoEn: hace(90) });
    expect(r.inicioEn).toBe(hace(90));
    expect(r.recibidoEn).toBe(AHORA);
  });

  it('OFF-05: repetir el mismo id con el mismo contenido devuelve el mismo reporte', async () => {
    const p = await nueva();
    const a = await p.reportes.iniciar('r-agua', { tipoServicio: 'agua', ocurridoEn: hace(20) });
    const b = await p.reportes.iniciar('r-agua', { tipoServicio: 'agua', ocurridoEn: hace(20) });
    expect(b).toEqual(a);
    expect(await p.reportes.obtenerMios()).toHaveLength(2); // el de agua y el corte de luz de la demo
  });

  it('OFF-05: el mismo id con otro contenido es 409 REPORTE_CONFLICTO', async () => {
    const p = await nueva();
    await p.reportes.iniciar('r-agua', { tipoServicio: 'agua', ocurridoEn: hace(20) });
    await expect(
      p.reportes.iniciar('r-agua', { tipoServicio: 'agua', ocurridoEn: hace(10) }),
    ).rejects.toMatchObject({ estado: 409, codigo: 'REPORTE_CONFLICTO' });
  });

  it('REP-05: no se pueden abrir dos reportes del mismo servicio', async () => {
    const p = await nueva();
    await p.reportes.iniciar('r-agua-1', { tipoServicio: 'agua', ocurridoEn: hace(20) });
    await expect(
      p.reportes.iniciar('r-agua-2', { tipoServicio: 'agua', ocurridoEn: hace(10) }),
    ).rejects.toMatchObject({ estado: 409, codigo: 'REPORTE_ABIERTO_DUPLICADO' });
  });

  it('REP-06: con un corte de luz abierto (el de la demo), sí se puede abrir uno de agua', async () => {
    const p = await nueva();
    await expect(
      p.reportes.iniciar('r-agua', { tipoServicio: 'agua', ocurridoEn: hace(20) }),
    ).resolves.toMatchObject({ tipoServicio: 'agua' });
    const abiertos = await p.reportes.obtenerMios({ abiertos: true });
    expect(abiertos.map((r) => r.tipoServicio).sort()).toEqual(['agua', 'electricidad']);
  });

  it('REP-03: el cierre calcula la duración en minutos', async () => {
    const p = await nueva();
    await p.reportes.iniciar('r-agua', { tipoServicio: 'agua', ocurridoEn: hace(100) });
    const cerrado = await p.reportes.cerrar('r-agua', { ocurridoEn: hace(10) });
    expect(cerrado).toMatchObject({ finEn: hace(10), duracionMin: 90 });
  });

  it('OFF-05: cerrar dos veces con la misma hora es idempotente; con otra hora, 409', async () => {
    const p = await nueva();
    await p.reportes.iniciar('r-agua', { tipoServicio: 'agua', ocurridoEn: hace(100) });
    const a = await p.reportes.cerrar('r-agua', { ocurridoEn: hace(10) });
    expect(await p.reportes.cerrar('r-agua', { ocurridoEn: hace(10) })).toEqual(a);
    await expect(p.reportes.cerrar('r-agua', { ocurridoEn: hace(5) })).rejects.toMatchObject({
      estado: 409,
      codigo: 'REPORTE_CONFLICTO',
    });
  });

  it('REP-04 (D-003): cerrar un reporte que no existe es 404 REPORTE_NO_ENCONTRADO', async () => {
    const p = await nueva();
    await expect(p.reportes.cerrar('no-existe', { ocurridoEn: hace(5) })).rejects.toMatchObject({
      estado: 404,
      codigo: 'REPORTE_NO_ENCONTRADO',
    });
  });

  it('REP-07: un fin anterior al inicio se rechaza con 422 HORA_INVALIDA, nunca se guarda', async () => {
    const p = await nueva();
    await p.reportes.iniciar('r-agua', { tipoServicio: 'agua', ocurridoEn: hace(30) });
    await expect(p.reportes.cerrar('r-agua', { ocurridoEn: hace(60) })).rejects.toMatchObject({
      estado: 422,
      codigo: 'HORA_INVALIDA',
    });
    const [r] = (await p.reportes.obtenerMios()).filter((x) => x.id === 'r-agua');
    expect(r?.finEn).toBeNull();
  });

  it('D-013: una hora futura (más allá de la tolerancia) o de hace más de 7 días es 422', async () => {
    const p = await nueva();
    await expect(
      p.reportes.iniciar('f', { tipoServicio: 'agua', ocurridoEn: hace(-10) }),
    ).rejects.toMatchObject({ estado: 422, codigo: 'HORA_INVALIDA' });
    await expect(
      p.reportes.iniciar('v', { tipoServicio: 'agua', ocurridoEn: hace(8 * 24 * 60) }),
    ).rejects.toMatchObject({ estado: 422, codigo: 'HORA_INVALIDA' });
    // Un minuto en el futuro cae dentro de la tolerancia de reloj de 2 min.
    await expect(
      p.reportes.iniciar('ok', { tipoServicio: 'agua', ocurridoEn: hace(-1) }),
    ).resolves.toBeDefined();
  });

  it('OFF-01: sin red la escritura falla con estado 0, como el fetch real', async () => {
    const p = await nueva();
    p.conexion.fijarModo('sin-conexion');
    await expect(
      p.reportes.iniciar('r-agua', { tipoServicio: 'agua', ocurridoEn: hace(20) }),
    ).rejects.toMatchObject({ estado: 0, esDeRed: true });
  });

  it('sin sesión es 401; con sesión pero sin perfil de residente, 403 REGISTRO_INCOMPLETO', async () => {
    const p = await nueva();
    await p.sesion.cerrar();
    await expect(
      p.reportes.iniciar('r', { tipoServicio: 'agua', ocurridoEn: hace(5) }),
    ).rejects.toMatchObject({ estado: 401, codigo: 'NO_AUTENTICADO' });

    // Una cuenta nueva (D-014) todavía no tiene perfil de residente.
    const sinPerfil = await cargarPuertosDemo({ escenario: 'en-linea' });
    const repo = crearRepositorioReportesMock({
      entorno: { reloj: sinPerfil.reloj, conexion: sinPerfil.conexion, latenciaMs: 0 },
      sesion: sinPerfil.sesion,
      sectorActual: () => null,
    });
    await expect(
      repo.iniciar('r', { tipoServicio: 'agua', ocurridoEn: hace(5) }),
    ).rejects.toMatchObject({ estado: 403, codigo: 'REGISTRO_INCOMPLETO' });
  });
});
