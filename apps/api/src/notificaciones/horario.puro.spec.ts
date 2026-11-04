import {
  enSilencio,
  franjasIniciadas,
  horaCaracas,
  inicioDelDia,
  primerMomentoPermitido,
  topeDiario,
} from './horario.puro';

const SILENCIO = { desde: 22, hasta: 7 };
/** Una hora de Caracas (UTC−4) del 3-nov-2026. */
const caracas = (hhmm: string, dia = '2026-11-03') => new Date(`${dia}T${hhmm}:00-04:00`);

describe('hora de Caracas', () => {
  it('UTC−4 todo el año: las 02:30 UTC son las 22:30 del día anterior', () => {
    expect(horaCaracas(new Date('2026-11-04T02:30:00Z'))).toBe(22);
  });

  it('"hoy" empieza a la medianoche de Caracas, no a la de UTC', () => {
    expect(inicioDelDia(caracas('23:59')).toISOString()).toBe('2026-11-03T04:00:00.000Z');
    expect(inicioDelDia(caracas('00:00')).toISOString()).toBe('2026-11-03T04:00:00.000Z');
  });
});

describe('horas silenciosas (22:00 a 07:00)', () => {
  it('NOT-04: las 21:59 todavía suenan (a las 21:00 suelen cortar la luz)', () => {
    expect(enSilencio(caracas('21:59'), SILENCIO)).toBe(false);
    expect(enSilencio(caracas('22:00'), SILENCIO)).toBe(true);
    expect(enSilencio(caracas('03:15'), SILENCIO)).toBe(true);
    expect(enSilencio(caracas('06:59'), SILENCIO)).toBe(true);
    expect(enSilencio(caracas('07:00'), SILENCIO)).toBe(false);
  });

  it('NOT-04: lo que pasa a las 23:10 sale a las 07:00 del día siguiente', () => {
    expect(primerMomentoPermitido(caracas('23:10'), SILENCIO)).toEqual(
      caracas('07:00', '2026-11-04'),
    );
  });

  it('NOT-04: lo que pasa a las 03:00 sale a las 07:00 del mismo día', () => {
    expect(primerMomentoPermitido(caracas('03:00'), SILENCIO)).toEqual(caracas('07:00'));
  });

  it('fuera del silencio sale en el momento', () => {
    expect(primerMomentoPermitido(caracas('14:20'), SILENCIO)).toEqual(caracas('14:20'));
  });

  it('un silencio que no cruza la medianoche también funciona, y desde = hasta lo apaga', () => {
    expect(enSilencio(caracas('13:30'), { desde: 13, hasta: 15 })).toBe(true);
    expect(enSilencio(caracas('15:00'), { desde: 13, hasta: 15 })).toBe(false);
    expect(enSilencio(caracas('03:00'), { desde: 0, hasta: 0 })).toBe(false);
  });
});

describe('franjas de los recordatorios', () => {
  it('NOT-08: con [19] la franja es de 19:00 a 19:59 y el tope es 1', () => {
    expect(franjasIniciadas(caracas('18:59'), [19], SILENCIO)).toBeNull();
    expect(franjasIniciadas(caracas('19:00'), [19], SILENCIO)).toBe(1);
    expect(franjasIniciadas(caracas('19:59'), [19], SILENCIO)).toBe(1);
    expect(franjasIniciadas(caracas('20:00'), [19], SILENCIO)).toBeNull();
    expect(topeDiario([19], SILENCIO)).toBe(1);
  });

  it('NOT-08: con [12, 19] caben dos al día, uno por franja', () => {
    expect(franjasIniciadas(caracas('12:30'), [12, 19], SILENCIO)).toBe(1);
    expect(franjasIniciadas(caracas('19:30'), [19, 12], SILENCIO)).toBe(2);
    expect(topeDiario([12, 19], SILENCIO)).toBe(2);
  });

  it('una hora dentro del silencio no cuenta como franja', () => {
    expect(franjasIniciadas(caracas('23:00'), [19, 23], SILENCIO)).toBeNull();
    expect(topeDiario([19, 23], SILENCIO)).toBe(1);
    expect(topeDiario([], SILENCIO)).toBe(0);
  });
});
