import { describe, expect, it } from 'vitest';
import { estadoVisual, peorEstado } from '../../../dominio/estado-visual';
import { cargarPuertosDemo } from './cargar';
import { ID_REPORTE_ABIERTO_DEMO } from './escenario';

// Estas pruebas cargan el `datos-ejemplo.json` real del canon: si alguien lo cambia sin
// actualizar los mocks, fallan aquí y no en la pantalla.
describe('demo: datos-ejemplo.json a través de los puertos', () => {
  it('el escenario sin-conexion parte sin red, con la última sincronización de las 14:32 y 1 aviso', async () => {
    const p = await cargarPuertosDemo({ escenario: 'sin-conexion' });
    expect(p.conexion.leer()).toEqual({
      modo: 'sin-conexion',
      ultimaSincronizacion: '2026-10-07T18:32:00Z',
    });
    const cola = await p.colaAvisos.listar();
    expect(cola).toHaveLength(1);
    expect(cola[0]).toMatchObject({
      accion: 'cierre',
      estado: 'pendiente',
      tipoServicio: 'electricidad',
    });
  });

  it('el escenario en-linea parte con red y la cola vacía', async () => {
    const p = await cargarPuertosDemo({ escenario: 'en-linea' });
    expect(p.conexion.leer().modo).toBe('en-linea');
    expect(await p.colaAvisos.listar()).toEqual([]);
  });

  it('el reloj está fijo en las 15:06 de Caracas (19:06 UTC)', async () => {
    const p = await cargarPuertosDemo({ escenario: 'en-linea' });
    expect(p.reloj.ahora()).toBe('2026-10-07T19:06:00.000Z');
  });

  it('los estados reproducen el mapa de la maqueta: S1 sin servicio, S3 sin confirmar, S2 y S4 con servicio', async () => {
    const p = await cargarPuertosDemo({ escenario: 'en-linea' });
    const filas = await p.estadosSector.leerTodos();
    const luz = (id: number) =>
      estadoVisual(filas.find((f) => f.sectorId === id && f.tipoServicio === 'electricidad'));
    expect([1, 2, 3, 4].map(luz)).toEqual([
      'sin-servicio',
      'con-servicio',
      'sin-confirmar',
      'con-servicio',
    ]);
    const sector1 = filas.filter((f) => f.sectorId === 1);
    expect(peorEstado(sector1)).toBe('sin-servicio');
  });

  it('la geometría es la del GeoJSON semilla, con los ids y nombres de los sectores de ejemplo', async () => {
    const p = await cargarPuertosDemo({ escenario: 'en-linea' });
    const geo = await p.sectores.obtenerGeoJson();
    expect(geo.features.map((f) => f.properties)).toEqual([
      { id: 1, nombre: 'Sector 1' },
      { id: 2, nombre: 'Sector 2' },
      { id: 3, nombre: 'Sector 3' },
      { id: 4, nombre: 'Sector 4' },
    ]);
    expect(geo.features.every((f) => f.geometry.type === 'MultiPolygon')).toBe(true);
  });

  it('EST-01/EST-04: la estimación con cifra y la insuficiente, sin repetir claves de consulta', async () => {
    const p = await cargarPuertosDemo({ escenario: 'en-linea' });
    expect(await p.estimaciones.obtener(1, 'electricidad')).toEqual({
      suficiente: true,
      n: 12,
      medianaMin: 240,
      q1Min: 150,
      q3Min: 360,
    });
    expect(await p.estimaciones.obtener(3, 'electricidad')).toEqual({ suficiente: false, n: 3 });
    // Un sector sin ciclos cerrados: n = 0, sin cifra.
    expect(await p.estimaciones.obtener(4, 'agua')).toEqual({ suficiente: false, n: 0 });
  });

  it('el resumen del Sector 1 trae los dos servicios, con el corte en curso primero', async () => {
    const p = await cargarPuertosDemo({ escenario: 'en-linea' });
    const resumen = await p.detalleSector.resumen(1);
    expect(resumen.sectorNombre).toBe('Sector 1');
    const luz = resumen.servicios.find((s) => s.tipoServicio === 'electricidad');
    expect(luz).toMatchObject({ estado: 'sin_servicio', desde: '2026-10-07T18:20:00Z' });
    expect(luz?.ultimosEventos[0]).toMatchObject({ finEn: null, duracionMin: null });
    expect(luz?.ultimosEventos[1]?.duracionMin).toBe(210); // 13:10 a 16:40 UTC
  });

  it('el historial solo trae eventos cerrados, del más nuevo al más viejo', async () => {
    const p = await cargarPuertosDemo({ escenario: 'en-linea' });
    const { eventos, siguienteCursor } = await p.detalleSector.historial(1, {
      tipoServicio: 'electricidad',
    });
    expect(eventos.map((e) => e.id)).toEqual([97, 95]);
    expect(eventos.every((e) => e.finEn !== null)).toBe(true);
    expect(siguienteCursor).toBeNull();
  });

  it('un sector que no existe da 404 SECTOR_NO_ENCONTRADO', async () => {
    const p = await cargarPuertosDemo({ escenario: 'en-linea' });
    await expect(p.detalleSector.resumen(99)).rejects.toMatchObject({
      estado: 404,
      codigo: 'SECTOR_NO_ENCONTRADO',
    });
  });

  it('el reporte abierto de la demo es el que cierra el aviso pendiente', async () => {
    const p = await cargarPuertosDemo({ escenario: 'sin-conexion' });
    const [aviso] = await p.colaAvisos.listar();
    expect(aviso?.reporteId).toBe(ID_REPORTE_ABIERTO_DEMO);
    p.conexion.fijarModo('en-linea');
    const abiertos = await p.reportes.obtenerMios({ abiertos: true });
    expect(abiertos.map((r) => r.id)).toEqual([ID_REPORTE_ABIERTO_DEMO]);
  });

  it('VIS-03: un cambio simulado de Realtime llega al suscriptor y a la siguiente lectura', async () => {
    const p = await cargarPuertosDemo({ escenario: 'en-linea' });
    const recibidos: string[] = [];
    const baja = p.estadosSector.suscribir((f) => recibidos.push(`${f.sectorId}/${f.estado}`));
    p.estadosSector.emitirCambio({
      sectorId: 2,
      tipoServicio: 'electricidad',
      estado: 'sin_servicio',
      reportesSinConfirmar: 0,
      desde: '2026-10-07T19:05:00Z',
      actualizadoEn: '2026-10-07T19:06:00Z',
    });
    expect(recibidos).toEqual(['2/sin_servicio']);
    const filas = await p.estadosSector.leerTodos();
    expect(filas.filter((f) => f.sectorId === 2 && f.tipoServicio === 'electricidad')).toHaveLength(
      1,
    );
    expect(filas.find((f) => f.sectorId === 2 && f.tipoServicio === 'electricidad')?.estado).toBe(
      'sin_servicio',
    );
    baja();
  });
});
