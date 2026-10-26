import { codificarCursor, decodificarCursor } from './cursor.puro';

describe('cursor del historial (T-034)', () => {
  it('ida y vuelta', () => {
    const p = { finEn: new Date('2026-10-07T19:06:00.123Z'), id: 42 };
    expect(decodificarCursor(codificarCursor(p))).toEqual(p);
  });

  it.each(['', 'no es base64!', 'YWJj', Buffer.from('2026-10-07|1').toString('base64url')])(
    'rechaza %j',
    (texto) => {
      expect(decodificarCursor(texto)).toBeNull();
    },
  );

  it('rechaza una fecha imposible y un id fuera de rango', () => {
    const malo = (s: string) => Buffer.from(s).toString('base64url');
    expect(decodificarCursor(malo('2026-13-45T99:99:99.000Z|1'))).toBeNull();
    expect(decodificarCursor(malo('2026-10-07T19:06:00.000Z|9999999999'))).toBeNull();
  });
});
