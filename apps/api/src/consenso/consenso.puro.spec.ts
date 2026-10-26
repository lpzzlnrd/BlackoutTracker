import {
  evaluarInicio,
  evaluarRestablecimiento,
  medianaDeHoras,
  type ReporteAbierto,
  type ReporteCerrado,
} from './consenso.puro';

// "ahora" fijo: 7-oct-2026 12:00 (UTC). Ningún test usa el reloj real.
const AHORA = new Date('2026-10-07T12:00:00.000Z');
const MIN = 60_000;
const N = 3;
const W_LUZ = 30; // minutos
const W_AGUA = 180;

const hace = (minutos: number) => new Date(AHORA.getTime() - minutos * MIN);
const rep = (residenteId: string, minutosAtras: number): ReporteAbierto => ({
  residenteId,
  inicioEn: hace(minutosAtras),
});
const luz = (reportes: ReporteAbierto[]) =>
  evaluarInicio(reportes, { n: N, ventanaMin: W_LUZ, ahora: AHORA });

describe('evaluarInicio', () => {
  it('sin reportes: no hay consenso ni reportes sin confirmar', () => {
    expect(luz([])).toEqual({ confirmado: false, inicioEvento: null, sinConfirmar: 0 });
  });

  it('CON-01: con N − 1 reportes distintos el estado no cambia y quedan 2 sin confirmar', () => {
    const r = luz([rep('a', 10), rep('b', 8)]);
    expect(r.confirmado).toBe(false);
    expect(r.inicioEvento).toBeNull();
    expect(r.sinConfirmar).toBe(2);
  });

  it('CON-02: con N reportes distintos dentro de la ventana se confirma', () => {
    const r = luz([rep('a', 10), rep('b', 8), rep('c', 5)]);
    expect(r.confirmado).toBe(true);
    expect(r.sinConfirmar).toBe(0);
  });

  it('CON-03: con N + 1 reportes sigue siendo un solo consenso y el inicio no se mueve', () => {
    const con3 = luz([rep('a', 10), rep('b', 8), rep('c', 5)]);
    const con4 = luz([rep('a', 10), rep('b', 8), rep('c', 5), rep('d', 2)]);
    expect(con4.confirmado).toBe(true);
    expect(con4.inicioEvento).toEqual(con3.inicioEvento);
  });

  it('CON-04: tres reportes del mismo usuario cuentan como uno', () => {
    const r = luz([rep('a', 12), rep('a', 9), rep('a', 6)]);
    expect(r.confirmado).toBe(false);
    expect(r.sinConfirmar).toBe(1);
  });

  it('CON-04: un usuario repetido no completa el consenso junto a otros dos', () => {
    const r = luz([rep('a', 12), rep('a', 9), rep('b', 6)]);
    expect(r.confirmado).toBe(false);
    expect(r.sinConfirmar).toBe(2);
  });

  it('CON-04: de un usuario con varios reportes cuenta el más antiguo', () => {
    const r = luz([rep('a', 4), rep('a', 20), rep('b', 15), rep('c', 12)]);
    // a=20, b=15, c=12 → mediana 15 (si contara el de a=4 la ventana sería otra)
    expect(r.confirmado).toBe(true);
    expect(r.inicioEvento).toEqual(hace(15));
  });

  it('CON-05: dos sectores con 2 reportes cada uno no se suman (entradas separadas)', () => {
    const sectorA = luz([rep('a', 10), rep('b', 8)]);
    const sectorB = luz([rep('c', 9), rep('d', 7)]);
    expect(sectorA.confirmado).toBe(false);
    expect(sectorB.confirmado).toBe(false);
  });

  it('CON-07: límite de la ventana, exactamente W se acepta y W + 1 ms se rechaza', () => {
    const dentro = luz([rep('a', W_LUZ), rep('b', 15), rep('c', 0)]);
    expect(dentro.confirmado).toBe(true);

    const fuera = luz([
      { residenteId: 'a', inicioEn: new Date(AHORA.getTime() - W_LUZ * MIN - 1) },
      rep('b', 15),
      rep('c', 0),
    ]);
    expect(fuera.confirmado).toBe(false);
  });

  it('CON-07: los reportes viejos fuera de la ventana no cuentan y los recientes quedan sin confirmar', () => {
    const r = luz([rep('a', 120), rep('b', 110), rep('c', 5), rep('d', 3)]);
    expect(r.confirmado).toBe(false);
    expect(r.sinConfirmar).toBe(2); // solo c y d están en la ventana que termina ahora
  });

  it('CON-07: la ventana depende del servicio (el agua tiene 180 min)', () => {
    const reportes = [rep('a', 100), rep('b', 60), rep('c', 5)];
    expect(luz(reportes).confirmado).toBe(false);
    const agua = evaluarInicio(reportes, { n: N, ventanaMin: W_AGUA, ahora: AHORA });
    expect(agua.confirmado).toBe(true);
  });

  it('encuentra la ventana ganadora aunque haya reportes sueltos antes', () => {
    const r = luz([rep('x', 300), rep('a', 20), rep('b', 15), rep('c', 10)]);
    expect(r.confirmado).toBe(true);
    expect(r.inicioEvento).toEqual(hace(15));
  });

  it('con varias ventanas posibles toma la primera en el tiempo', () => {
    const r = luz([
      rep('a', 200),
      rep('b', 195),
      rep('c', 190),
      rep('d', 20),
      rep('e', 15),
      rep('f', 10),
    ]);
    expect(r.inicioEvento).toEqual(hace(195));
  });

  it('el orden de entrada no cambia el resultado', () => {
    const reportes = [rep('c', 5), rep('a', 10), rep('b', 8)];
    expect(luz(reportes)).toEqual(luz([...reportes].reverse()));
  });

  it('D-007: el inicio del evento es la mediana de los N primeros de la ventana ganadora', () => {
    // a=20, b=19, c=1: la mediana es 19 (un vecino que reporta tarde no mueve el inicio)
    const r = luz([rep('a', 20), rep('b', 19), rep('c', 1)]);
    expect(r.inicioEvento).toEqual(hace(19));
  });

  it('D-007: con N par se promedian los dos centrales', () => {
    const r = evaluarInicio([rep('a', 20), rep('b', 16), rep('c', 10), rep('d', 4)], {
      n: 4,
      ventanaMin: W_LUZ,
      ahora: AHORA,
    });
    expect(r.confirmado).toBe(true);
    expect(r.inicioEvento).toEqual(hace(13));
  });

  it('N es configurable (N = 1 confirma con un solo reporte)', () => {
    const r = evaluarInicio([rep('a', 5)], { n: 1, ventanaMin: W_LUZ, ahora: AHORA });
    expect(r.confirmado).toBe(true);
    expect(r.inicioEvento).toEqual(hace(5));
  });

  it('rechaza un N que no es un entero positivo', () => {
    expect(() => evaluarInicio([], { n: 0, ventanaMin: W_LUZ, ahora: AHORA })).toThrow(RangeError);
    expect(() => evaluarInicio([], { n: 2.5, ventanaMin: W_LUZ, ahora: AHORA })).toThrow(
      RangeError,
    );
  });
});

describe('medianaDeHoras', () => {
  it('con cantidad impar es el valor central', () => {
    expect(medianaDeHoras([hace(1), hace(30), hace(10)])).toEqual(hace(10));
  });

  it('con cantidad par promedia los dos centrales', () => {
    expect(medianaDeHoras([hace(40), hace(10), hace(20), hace(30)])).toEqual(hace(25));
  });
});

describe('evaluarRestablecimiento', () => {
  // El evento abierto empezó hace 3 h; los cierres son posteriores.
  const INICIO = hace(180);
  const cerr = (residenteId: string, minutosAtras: number): ReporteCerrado => ({
    residenteId,
    finEn: hace(minutosAtras),
  });
  const volvio = (cerrados: ReporteCerrado[], reportesAbiertos = 1) =>
    evaluarRestablecimiento(cerrados, {
      n: N,
      ventanaMin: W_LUZ,
      inicioEvento: INICIO,
      reportesAbiertos,
    });

  it('sin cierres el evento sigue abierto', () => {
    expect(volvio([], 3)).toEqual({ cerrado: false, finEvento: null, motivo: null });
  });

  it('CON-06: con N cierres distintos dentro de la ventana se cierra y el fin es la mediana', () => {
    const r = volvio([cerr('a', 20), cerr('b', 15), cerr('c', 4)]);
    expect(r.cerrado).toBe(true);
    expect(r.motivo).toBe('consenso');
    expect(r.finEvento).toEqual(hace(15));
  });

  it('CON-06: con N − 1 cierres y otros reportes aún abiertos el evento no se cierra', () => {
    const r = volvio([cerr('a', 10), cerr('b', 8)], 1);
    expect(r).toEqual({ cerrado: false, finEvento: null, motivo: null });
  });

  it('CON-04: varios cierres del mismo usuario cuentan como uno', () => {
    const r = volvio([cerr('a', 10), cerr('a', 9), cerr('a', 8), cerr('b', 7)], 1);
    expect(r.cerrado).toBe(false);
  });

  it('CON-04: de un usuario con varios cierres cuenta el más antiguo', () => {
    const r = volvio([cerr('a', 20), cerr('a', 2), cerr('b', 15), cerr('c', 10)]);
    expect(r.finEvento).toEqual(hace(15));
  });

  it('CON-07: los cierres fuera de la ventana no se suman (límite W exacto y W + 1 ms)', () => {
    const dentro = volvio([cerr('a', 40), cerr('b', 25), cerr('c', 10)]);
    expect(dentro.cerrado).toBe(true);
    const fuera = volvio([
      { residenteId: 'a', finEn: new Date(hace(40).getTime() - 1) },
      cerr('b', 25),
      cerr('c', 10),
    ]);
    expect(fuera.cerrado).toBe(false);
  });

  it('cierra por "ya no quedan reportes abiertos" aunque los cierres estén dispersos', () => {
    const r = volvio([cerr('a', 120), cerr('b', 60), cerr('c', 5)], 0);
    expect(r.cerrado).toBe(true);
    expect(r.motivo).toBe('sin_abiertos');
    expect(r.finEvento).toEqual(hace(60));
  });

  it('cierra con un solo cierre si es el único reportante y no queda nada abierto', () => {
    const r = volvio([cerr('a', 5)], 0);
    expect(r).toEqual({ cerrado: true, finEvento: hace(5), motivo: 'sin_abiertos' });
  });

  it('T-050: sin cierres ni reportes vivos (todos vencieron) se cierra como incompleto, sin fin', () => {
    expect(volvio([], 0)).toEqual({ cerrado: true, finEvento: null, motivo: 'incompleto' });
  });

  it('T-050: los cierres anteriores al evento no cuentan; sin otros, el ciclo es incompleto', () => {
    expect(volvio([cerr('a', 200)], 0)).toEqual({
      cerrado: true,
      finEvento: null,
      motivo: 'incompleto',
    });
  });

  it('T-050: con algún reporte vivo y sin cierres no hay nada que cerrar', () => {
    expect(volvio([], 1)).toEqual({ cerrado: false, finEvento: null, motivo: null });
  });

  it('el consenso de N tiene prioridad sobre "sin abiertos" y usa solo los de la ventana', () => {
    const r = volvio([cerr('a', 120), cerr('b', 20), cerr('c', 15), cerr('d', 10)], 0);
    expect(r.motivo).toBe('consenso');
    expect(r.finEvento).toEqual(hace(15));
  });

  it('ignora los cierres anteriores al inicio del evento', () => {
    const r = volvio([cerr('a', 200), cerr('b', 190), cerr('c', 185)], 1);
    expect(r.cerrado).toBe(false);
  });

  it('el orden de entrada no cambia el resultado', () => {
    const cierres = [cerr('a', 20), cerr('b', 15), cerr('c', 4)];
    expect(volvio([...cierres].reverse())).toEqual(volvio(cierres));
  });

  it('N es configurable y se rechaza un N que no es un entero positivo', () => {
    const uno = evaluarRestablecimiento([cerr('a', 5)], {
      n: 1,
      ventanaMin: W_LUZ,
      inicioEvento: INICIO,
      reportesAbiertos: 2,
    });
    expect(uno.motivo).toBe('consenso');
    expect(() =>
      evaluarRestablecimiento([], {
        n: 0,
        ventanaMin: W_LUZ,
        inicioEvento: INICIO,
        reportesAbiertos: 0,
      }),
    ).toThrow(RangeError);
  });
});
