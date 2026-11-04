import { TipoNotificacion } from '@blackout/shared';
import { cuando, type DatosRedaccion, duracion, hora, redactar } from './redaccion.puro';

const caracas = (hhmm: string, dia = '2026-11-03') => new Date(`${dia}T${hhmm}:00-04:00`);
const AHORA = caracas('19:00');

const base = (extra: Partial<DatosRedaccion>): DatosRedaccion => ({
  id: '0b8f6a3e-3c55-4d2e-9a43-6f1f1a2f9a10',
  tipo: TipoNotificacion.CorteConfirmado,
  sectorId: 7,
  sectorNombre: 'Guaparo',
  tipoServicio: 'electricidad',
  ahora: AHORA,
  ...extra,
});

describe('formatos', () => {
  it('hora de 24 h en Caracas', () => {
    expect(hora(new Date('2026-11-03T18:20:00Z'))).toBe('14:20');
  });

  it('duración como en el canon del frontend', () => {
    expect(duracion(240)).toBe('4 h');
    expect(duracion(220)).toBe('3 h 40 min');
    expect(duracion(45)).toBe('45 min');
    expect(duracion(1860)).toBe('31 h');
  });

  it('cuándo: hoy, ayer o la fecha', () => {
    expect(cuando(caracas('14:20'), AHORA)).toBe('las 14:20');
    expect(cuando(caracas('14:20', '2026-11-02'), AHORA)).toBe('ayer a las 14:20');
    expect(cuando(caracas('09:05', '2026-10-30'), AHORA)).toBe('el 30/10 a las 09:05');
  });
});

describe('voz B: corte confirmado', () => {
  const evento = { inicioEn: caracas('14:20'), finEn: null };

  it('NOT-12: con estimación, «aprox.» y su n', () => {
    const n = redactar(
      base({ evento, vecinos: 3, estimacion: { suficiente: true, n: 12, medianaMin: 240 } }),
    );
    expect(n.titulo).toBe('Se fue la luz en Guaparo');
    expect(n.cuerpo).toBe(
      'Desde las 14:20, lo confirmaron 3 vecinos. Suele volver en aprox. 4 h, según 12 cortes registrados.',
    );
  });

  it('NOT-12: con datos insuficientes no hay cifra (EST-04)', () => {
    const n = redactar(base({ evento, vecinos: 3, estimacion: { suficiente: false, n: 2 } }));
    expect(n.cuerpo).toContain('Todavía no hay datos suficientes');
    expect(n.cuerpo).not.toMatch(/\d+ h|aprox\./);
  });

  it('a quien ayudó a confirmarlo se le reconoce', () => {
    expect(redactar(base({ evento, vecinos: 3, aporto: true })).cuerpo).toBe(
      'Desde las 14:20. Tu reporte y el de 2 vecinos más lo confirmaron.',
    );
    expect(redactar(base({ evento, vecinos: 2, aporto: true })).cuerpo).toBe(
      'Desde las 14:20. Tu reporte y el de 1 vecino más lo confirmaron.',
    );
  });

  it('dice si el corte también está en los sectores vecinos (idea b)', () => {
    const n = redactar(base({ evento, vecinos: 3, vecinosSinServicio: 4, tipoServicio: 'agua' }));
    expect(n.titulo).toBe('Se fue el agua en Guaparo');
    expect(n.cuerpo).toContain('También sin agua en 4 sectores vecinos.');
  });

  it('notificación viva: la etiqueta es la del corte, abre el mapa y no tiene botones', () => {
    const n = redactar(base({ evento, vecinos: 3 }));
    expect(n.etiqueta).toBe('corte-7-electricidad');
    expect(n.url).toBe('/?n=0b8f6a3e-3c55-4d2e-9a43-6f1f1a2f9a10');
    expect(n.renotificar).toBe(true);
    expect(n.acciones).toEqual([]);
  });
});

describe('voz B: servicio restablecido', () => {
  it('«¡Llegó el agua!» invita a llenar los tobos y compara con lo habitual', () => {
    const n = redactar(
      base({
        tipo: TipoNotificacion.ServicioRestablecido,
        tipoServicio: 'agua',
        evento: { inicioEn: caracas('08:00', '2026-11-02'), finEn: caracas('15:00') },
        estimacion: { suficiente: true, n: 9, medianaMin: 1440 },
      }),
    );
    expect(n.titulo).toBe('¡Llegó el agua a Guaparo!');
    expect(n.cuerpo).toBe(
      'Aprovecha y llena los tobos. Llegó a las 15:00, después de 31 h. Esta vez duró más de lo habitual (aprox. 24 h, según 9 cortes registrados).',
    );
    expect(n.etiqueta).toBe('corte-7-agua');
  });

  it('NOT-05: de noche pide perdón por la hora', () => {
    const n = redactar(
      base({
        tipo: TipoNotificacion.ServicioRestablecido,
        tipoServicio: 'agua',
        deNoche: true,
        evento: { inicioEn: caracas('08:00'), finEn: caracas('15:00') },
      }),
    );
    expect(n.titulo).toBe('Perdón la hora: ¡llegó el agua a Guaparo!');
  });

  it('la luz «vuelve» y se agradece a quien avisó', () => {
    const n = redactar(
      base({
        tipo: TipoNotificacion.ServicioRestablecido,
        evento: { inicioEn: caracas('14:20'), finEn: caracas('18:00') },
        estimacion: { suficiente: true, n: 12, medianaMin: 240 },
        aporto: true,
      }),
    );
    expect(n.titulo).toBe('¡Volvió la luz a Guaparo!');
    expect(n.cuerpo).toBe(
      'Volvió a las 18:00, después de 3 h 40 min. Esta vez duró lo habitual (aprox. 4 h, según 12 cortes registrados). Gracias por avisar.',
    );
  });
});

describe('voz B: recordatorios', () => {
  it('NOT-11: la pregunta no sugiere la respuesta y trae dos botones simétricos', () => {
    const n = redactar(base({ tipo: TipoNotificacion.PreguntaVecinos }));
    expect(n.titulo).toBe('¿Y la luz por tu casa?');
    expect(n.cuerpo).toBe(
      'Hay reportes sin confirmar en Guaparo. Cuéntanos cómo está, sea cual sea la respuesta.',
    );
    expect(n.cuerpo).not.toMatch(/también|se fue/i);
    expect(n.acciones.map((a) => a.accion)).toEqual(['se-fue', 'aqui-si-hay']);
    expect(n.url).toBe('/reportar?servicio=electricidad&n=0b8f6a3e-3c55-4d2e-9a43-6f1f1a2f9a10');
  });

  it('NOT-10: «¿ya volvió?» con la hora del reporte', () => {
    const n = redactar(
      base({
        tipo: TipoNotificacion.ReporteAbierto,
        reporteInicioEn: caracas('14:20', '2026-11-02'),
      }),
    );
    expect(n.titulo).toBe('Oye, ¿ya volvió la luz?');
    expect(n.cuerpo).toBe(
      'Tu reporte sigue abierto desde ayer a las 14:20. Si ya volvió, avísales a tus vecinos: así la estimación sale mejor.',
    );
  });

  it('NOT-06: el resumen del día junta los dos servicios', () => {
    const n = redactar(
      base({
        tipo: TipoNotificacion.ResumenDia,
        tipoServicio: null,
        actividad: [
          {
            tipoServicio: 'electricidad',
            cerradosHoy: 2,
            minutosCerrados: 310,
            enCursoDesde: caracas('18:05'),
          },
          {
            tipoServicio: 'agua',
            cerradosHoy: 0,
            minutosCerrados: 0,
            enCursoDesde: caracas('08:00'),
          },
        ],
      }),
    );
    expect(n.titulo).toBe('Hoy en Guaparo');
    expect(n.cuerpo).toBe(
      'La luz se fue 2 veces (5 h 10 min en total) y ahora sigue sin volver desde las 18:05; el agua sigue sin llegar desde las 08:00. Échale un ojo al mapa.',
    );
    expect(n.etiqueta).toBe('resumen-7');
    expect(n.url).toBe('/panel?n=0b8f6a3e-3c55-4d2e-9a43-6f1f1a2f9a10');
  });
});

describe('terminología', () => {
  it('NOT-12: ningún texto habla de predicción', () => {
    const evento = { inicioEn: caracas('14:20'), finEn: caracas('18:00') };
    const estimacion = { suficiente: true as const, n: 12, medianaMin: 240 };
    const textos = [
      base({ evento, vecinos: 3, estimacion }),
      base({ tipo: TipoNotificacion.ServicioRestablecido, evento, estimacion }),
      base({ tipo: TipoNotificacion.PreguntaVecinos }),
      base({ tipo: TipoNotificacion.ReporteAbierto, reporteInicioEn: caracas('09:00') }),
    ].map((d) => {
      const n = redactar(d);
      return `${n.titulo} ${n.cuerpo}`;
    });
    for (const t of textos) expect(t).not.toMatch(/predic|pronóstic/i);
  });
});
