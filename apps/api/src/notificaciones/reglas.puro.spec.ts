import { TipoNotificacion } from '@blackout/shared';
import {
  elegirRecordatorio,
  esEndpointPushValido,
  type EventoDelDia,
  type HechosRecordatorio,
  respetaPausa,
  resumirActividad,
  umbralReporteAbiertoMin,
} from './reglas.puro';

const AHORA = new Date('2026-11-03T23:00:00Z'); // 19:00 en Caracas
const haceHoras = (h: number) => new Date(AHORA.getTime() - h * 3_600_000);
const haceDias = (d: number) => haceHoras(d * 24);

describe('endpoints push (anti-SSRF)', () => {
  it.each([
    'https://fcm.googleapis.com/fcm/send/abc:APA91',
    'https://updates.push.services.mozilla.com/wpush/v2/gAAAA',
    'https://web.push.apple.com/QGuQyavXutnMH',
    'https://wns2-by3p.notify.windows.com/w/?token=BQYAAA',
  ])('NOT-13: acepta el servicio push de un navegador: %s', (url) => {
    expect(esEndpointPushValido(url)).toBe(true);
  });

  it.each([
    'http://fcm.googleapis.com/fcm/send/abc',
    'https://fcm.googleapis.com:8443/fcm/send/abc',
    'https://usuario:clave@fcm.googleapis.com/fcm/send/abc',
    'https://fcm.googleapis.com.atacante.com/x',
    'https://169.254.169.254/latest/meta-data',
    'https://localhost/api/reportes',
    'https://blackouttracker.onrender.com/api/salud',
    'no es una url',
  ])('NOT-13: rechaza todo lo demás: %s', (url) => {
    expect(esEndpointPushValido(url)).toBe(false);
  });
});

describe('pausa tras recordatorios ignorados', () => {
  it('NOT-09: con menos de 3 enviados no hay pausa', () => {
    expect(respetaPausa([{ enviadaEn: haceDias(1), abierta: false }], AHORA)).toBe(true);
  });

  it('NOT-09: 3 seguidos sin abrir → uno por semana', () => {
    const ignorados = [1, 2, 3].map((d) => ({ enviadaEn: haceDias(d), abierta: false }));
    expect(respetaPausa(ignorados, AHORA)).toBe(false);
    const viejos = [7, 8, 9].map((d) => ({ enviadaEn: haceDias(d), abierta: false }));
    expect(respetaPausa(viejos, AHORA)).toBe(true);
  });

  it('NOT-09: si abrió alguno de los últimos 3, sigue normal', () => {
    const enviados = [
      { enviadaEn: haceDias(1), abierta: false },
      { enviadaEn: haceDias(2), abierta: true },
      { enviadaEn: haceDias(3), abierta: false },
    ];
    expect(respetaPausa(enviados, AHORA)).toBe(true);
  });
});

describe('umbral de «¿ya volvió?»', () => {
  it('NOT-10: con datos suficientes es la mediana del sector', () => {
    expect(umbralReporteAbiertoMin({ suficiente: true, n: 12, medianaMin: 240 }, 12)).toBe(240);
  });

  it('NOT-10: sin datos suficientes es el valor por defecto (12 h)', () => {
    expect(umbralReporteAbiertoMin({ suficiente: false, n: 2 }, 12)).toBe(720);
  });
});

describe('actividad del día en un sector', () => {
  const hoy = new Date('2026-11-03T04:00:00Z'); // medianoche de Caracas
  const ev = (e: Partial<EventoDelDia>): EventoDelDia => ({
    tipoServicio: 'electricidad',
    inicioEn: haceHoras(6),
    finEn: haceHoras(4),
    confirmadoEn: haceHoras(6),
    incompleto: false,
    ...e,
  });

  it('NOT-06: suma los cortes cerrados hoy y marca el que sigue en curso', () => {
    const actividad = resumirActividad(
      [
        ev({}),
        ev({ inicioEn: haceHoras(3), finEn: haceHoras(2), confirmadoEn: haceHoras(3) }),
        ev({ inicioEn: haceHoras(1), finEn: null, confirmadoEn: haceHoras(1) }),
        ev({
          tipoServicio: 'agua',
          inicioEn: haceHoras(30),
          finEn: null,
          confirmadoEn: haceHoras(30),
        }),
      ],
      hoy,
    );
    expect(actividad).toEqual([
      { tipoServicio: 'agua', cerradosHoy: 0, minutosCerrados: 0, enCursoDesde: haceHoras(30) },
      {
        tipoServicio: 'electricidad',
        cerradosHoy: 2,
        minutosCerrados: 180,
        enCursoDesde: haceHoras(1),
      },
    ]);
  });

  it('ni los cortes de ayer ya cerrados ni los incompletos cuentan', () => {
    expect(
      resumirActividad(
        [
          ev({ inicioEn: haceHoras(40), finEn: haceHoras(38), confirmadoEn: haceHoras(40) }),
          ev({ finEn: null, incompleto: true }),
        ],
        hoy,
      ),
    ).toEqual([]);
  });
});

describe('qué recordatorio merece la pena', () => {
  const sinNada: HechosRecordatorio = {
    ahora: AHORA,
    reportesAbiertos: [],
    actividadHoy: [],
    sinConfirmar: [],
  };

  it('NOT-07: sin nada útil que contar no hay recordatorio', () => {
    expect(elegirRecordatorio(sinNada)).toBeNull();
    expect(
      elegirRecordatorio({
        ...sinNada,
        actividadHoy: [
          { tipoServicio: 'agua', cerradosHoy: 0, minutosCerrados: 0, enCursoDesde: null },
        ],
      }),
    ).toBeNull();
  });

  it('NOT-10: un reporte abierto más que la mediana va primero', () => {
    const r = elegirRecordatorio({
      ...sinNada,
      reportesAbiertos: [
        { reporteId: 'r1', tipoServicio: 'electricidad', inicioEn: haceHoras(5), umbralMin: 240 },
      ],
      actividadHoy: [
        {
          tipoServicio: 'electricidad',
          cerradosHoy: 0,
          minutosCerrados: 0,
          enCursoDesde: haceHoras(5),
        },
      ],
    });
    expect(r).toEqual({
      tipo: TipoNotificacion.ReporteAbierto,
      tipoServicio: 'electricidad',
      reporteId: 'r1',
    });
  });

  it('NOT-10: un reporte abierto que aún no pasa la mediana no cuenta', () => {
    const r = elegirRecordatorio({
      ...sinNada,
      reportesAbiertos: [
        { reporteId: 'r1', tipoServicio: 'agua', inicioEn: haceHoras(2), umbralMin: 240 },
      ],
    });
    expect(r).toBeNull();
  });

  it('NOT-06: si hubo cortes hoy, el resumen del día', () => {
    const r = elegirRecordatorio({
      ...sinNada,
      actividadHoy: [
        { tipoServicio: 'agua', cerradosHoy: 2, minutosCerrados: 300, enCursoDesde: null },
      ],
    });
    expect(r).toEqual({ tipo: TipoNotificacion.ResumenDia });
  });

  it('NOT-11: con reportes sin confirmar, la pregunta, salvo del servicio que él ya reportó', () => {
    expect(elegirRecordatorio({ ...sinNada, sinConfirmar: ['agua'] })).toEqual({
      tipo: TipoNotificacion.PreguntaVecinos,
      tipoServicio: 'agua',
    });
    expect(
      elegirRecordatorio({
        ...sinNada,
        sinConfirmar: ['agua'],
        reportesAbiertos: [
          { reporteId: 'r1', tipoServicio: 'agua', inicioEn: haceHoras(1), umbralMin: 240 },
        ],
      }),
    ).toBeNull();
  });
});
