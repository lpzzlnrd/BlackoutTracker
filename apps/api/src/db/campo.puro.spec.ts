import { claveSector, leerCsv, leerFechaConZona, validarCampo } from './campo.puro';

const AHORA = new Date('2026-10-25T12:00:00Z');
const SECTORES = new Map([
  [claveSector('Guaparo Noroeste'), 1],
  [claveSector('Guaparo Sureste'), 4],
]);
const CABECERA = 'sector,tipo_servicio,inicio,fin';
const csv = (...filas: string[]) => [CABECERA, ...filas].join('\n');
const validar = (...filas: string[]) => validarCampo(csv(...filas), SECTORES, AHORA);

describe('leerCsv (T-044)', () => {
  it('parte por comas, recorta espacios y numera las líneas del archivo', () => {
    expect(leerCsv('a, b ,c\n\n# comentario\nd,e,f')).toEqual([
      { linea: 1, campos: ['a', 'b', 'c'] },
      { linea: 4, campos: ['d', 'e', 'f'] },
    ]);
  });

  it('admite comillas con comas y comillas escapadas, CRLF y BOM', () => {
    const bom = String.fromCharCode(0xfeff);
    expect(leerCsv(`${bom}"x, y","di ""hola""",z\r\nfin`)).toEqual([
      { linea: 1, campos: ['x, y', 'di "hola"', 'z'] },
      { linea: 2, campos: ['fin'] },
    ]);
  });
});

describe('leerFechaConZona (T-044)', () => {
  it('acepta ISO 8601 con Z o con desfase', () => {
    expect(leerFechaConZona('2026-09-01T05:00:00-04:00')?.toISOString()).toBe(
      '2026-09-01T09:00:00.000Z',
    );
    expect(leerFechaConZona('2026-09-01T09:00Z')?.toISOString()).toBe('2026-09-01T09:00:00.000Z');
  });

  it.each([
    ['sin zona', '2026-09-01T05:00:00'],
    ['solo la fecha', '2026-09-01'],
    ['un día que no existe', '2026-02-31T10:00:00Z'],
    ['una hora que no existe', '2026-09-01T25:00:00Z'],
    ['otro formato', '01/09/2026 05:00'],
    ['vacía', ''],
  ])('rechaza %s', (_, texto) => {
    expect(leerFechaConZona(texto)).toBeNull();
  });
});

describe('validarCampo (T-044)', () => {
  it('acepta un ciclo completo y resuelve el sector sin distinguir mayúsculas ni espacios', () => {
    const { validas, invalidas } = validar(
      ' guaparo   NOROESTE ,Electricidad,2026-09-02T14:10:00-04:00,2026-09-02T17:40:00-04:00',
    );
    expect(invalidas).toEqual([]);
    expect(validas).toEqual([
      {
        linea: 2,
        sectorId: 1,
        tipoServicio: 'electricidad',
        inicio: new Date('2026-09-02T18:10:00Z'),
        fin: new Date('2026-09-02T21:40:00Z'),
      },
    ]);
  });

  it('acepta la cabecera en mayúsculas', () => {
    const texto =
      'SECTOR,Tipo_Servicio,INICIO,fin\nGuaparo Sureste,agua,2026-09-05T05:00Z,2026-09-05T21:00Z';
    expect(validarCampo(texto, SECTORES, AHORA).validas).toHaveLength(1);
  });

  it.each([
    ['otra cabecera', 'sector,servicio,inicio,fin'],
    ['columnas en otro orden', 'sector,tipo_servicio,fin,inicio'],
    ['un archivo vacío', ''],
  ])('lanza si el archivo tiene %s', (_, cabecera) => {
    expect(() => validarCampo(cabecera, SECTORES, AHORA)).toThrow(/cabecera/);
  });

  it.each([
    ['columnas de menos', 'Guaparo Sureste,agua,2026-09-05T05:00Z', /4 columnas/],
    ['un sector que no existe', 'Trigal,agua,2026-09-05T05:00Z,2026-09-05T21:00Z', /no existe/],
    [
      'un servicio inválido',
      'Guaparo Sureste,luz,2026-09-05T05:00Z,2026-09-05T21:00Z',
      /no es válido/,
    ],
    ['un inicio sin zona', 'Guaparo Sureste,agua,2026-09-05T05:00,2026-09-05T21:00Z', /inicio/],
    ['un fin ilegible', 'Guaparo Sureste,agua,2026-09-05T05:00Z,ayer', /fin "ayer"/],
    ['un ciclo abierto (sin fin)', 'Guaparo Sureste,agua,2026-09-05T05:00Z,', /ciclos completos/],
    [
      'el fin antes del inicio',
      'Guaparo Sureste,agua,2026-09-05T21:00Z,2026-09-05T05:00Z',
      /posterior/,
    ],
    ['una duración cero', 'Guaparo Sureste,agua,2026-09-05T05:00Z,2026-09-05T05:00Z', /posterior/],
    ['el fin en el futuro', 'Guaparo Sureste,agua,2026-10-25T05:00Z,2026-10-25T12:01Z', /futuro/],
  ])('rechaza %s, con su número de línea', (_, fila, motivo) => {
    const { validas, invalidas } = validar(fila);
    expect(validas).toEqual([]);
    expect(invalidas).toEqual([{ linea: 2, motivo: expect.stringMatching(motivo) as string }]);
  });

  it('el fin exactamente en `ahora` se acepta (límite inclusivo)', () => {
    expect(
      validar('Guaparo Sureste,agua,2026-10-25T05:00Z,2026-10-25T12:00Z').validas,
    ).toHaveLength(1);
  });

  it('las filas inválidas no impiden las válidas', () => {
    const { validas, invalidas } = validar(
      'Guaparo Sureste,agua,2026-09-05T05:00Z,2026-09-05T21:00Z',
      'Trigal,agua,2026-09-05T05:00Z,2026-09-05T21:00Z',
      'Guaparo Noroeste,agua,2026-09-05T05:00Z,2026-09-05T21:00Z',
    );
    expect(validas.map((v) => v.linea)).toEqual([2, 4]);
    expect(invalidas.map((v) => v.linea)).toEqual([3]);
  });

  it('una fila repetida en el archivo se informa y no se duplica', () => {
    const fila = 'Guaparo Sureste,agua,2026-09-05T05:00Z,2026-09-05T21:00Z';
    const { validas, invalidas } = validar(fila, fila);
    expect(validas).toHaveLength(1);
    expect(invalidas).toEqual([{ linea: 3, motivo: 'Repite la línea 2' }]);
  });

  it('rechaza un ciclo que se solapa con otro del mismo sector y servicio', () => {
    const { invalidas } = validar(
      'Guaparo Sureste,agua,2026-09-05T05:00Z,2026-09-05T21:00Z',
      'Guaparo Sureste,agua,2026-09-05T20:00Z,2026-09-06T02:00Z',
    );
    expect(invalidas).toEqual([{ linea: 3, motivo: 'Se solapa con la línea 2' }]);
  });

  it('no hay solape si uno empieza justo cuando termina el otro, ni entre servicios o sectores', () => {
    const { validas, invalidas } = validar(
      'Guaparo Sureste,agua,2026-09-05T05:00Z,2026-09-05T21:00Z',
      'Guaparo Sureste,agua,2026-09-05T21:00Z,2026-09-06T02:00Z',
      'Guaparo Sureste,electricidad,2026-09-05T06:00Z,2026-09-05T08:00Z',
      'Guaparo Noroeste,agua,2026-09-05T06:00Z,2026-09-05T08:00Z',
    );
    expect(invalidas).toEqual([]);
    expect(validas).toHaveLength(4);
  });
});
