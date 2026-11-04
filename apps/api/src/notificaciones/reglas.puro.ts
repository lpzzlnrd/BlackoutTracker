// Reglas de las notificaciones (T-072, D-042): a qué servicios push se envía, cuándo se pausa a un
// vecino que no las abre y qué recordatorio merece la pena. Lógica pura.
import {
  type EstimacionDto,
  TIPOS_SERVICIO,
  TipoNotificacion,
  type TipoServicio,
} from '@blackout/shared';
import type { ActividadDia } from './redaccion.puro';

const MS_MINUTO = 60_000;
const MS_DIA = 24 * 60 * MS_MINUTO;

/**
 * Hosts de los servicios push de los navegadores: Chrome, Edge (Windows), Firefox y Safari. La API
 * hace un POST a la URL de la suscripción, así que aceptar cualquiera la convertiría en un
 * lanzador de solicitudes contra terceros (SSRF). Opera, Brave y Samsung Internet usan FCM.
 */
const HOSTS_PUSH: readonly RegExp[] = [
  /^fcm\.googleapis\.com$/,
  /^[a-z0-9-]+\.push\.services\.mozilla\.com$/,
  /^web\.push\.apple\.com$/,
  /^[a-z0-9-]+\.notify\.windows\.com$/,
];

/** Si la URL de una suscripción es de un servicio push conocido, por HTTPS y sin credenciales ni puerto. */
export function esEndpointPushValido(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  return (
    url.protocol === 'https:' &&
    url.port === '' &&
    url.username === '' &&
    url.password === '' &&
    HOSTS_PUSH.some((h) => h.test(url.hostname))
  );
}

/** Un recordatorio ya enviado, del más reciente al más antiguo. */
export interface RecordatorioEnviado {
  enviadaEn: Date;
  abierta: boolean;
}

/** Recordatorios seguidos sin abrir que activan la pausa. */
export const PAUSA_TRAS_IGNORADOS = 3;
/** Con la pausa activa, a lo sumo un recordatorio por semana. */
export const PAUSA_DIAS = 7;

/**
 * Si el vecino ignoró los últimos 3 recordatorios, pasa a uno por semana hasta que abra alguno. Así
 * no se cansa de la app y no bloquea el permiso, que también lleva los avisos de corte.
 */
export function respetaPausa(enviados: readonly RecordatorioEnviado[], ahora: Date): boolean {
  const ultimos = enviados.slice(0, PAUSA_TRAS_IGNORADOS);
  if (ultimos.length < PAUSA_TRAS_IGNORADOS || ultimos.some((r) => r.abierta)) return true;
  return ahora.getTime() - ultimos[0].enviadaEn.getTime() >= PAUSA_DIAS * MS_DIA;
}

/**
 * Minutos que puede llevar abierto un reporte antes de preguntar «¿ya volvió?»: la mediana del
 * sector si hay datos suficientes (la estadística marca el momento) y si no, `horasSinEstimacion`.
 */
export function umbralReporteAbiertoMin(
  estimacion: EstimacionDto,
  horasSinEstimacion: number,
): number {
  return estimacion.suficiente ? estimacion.medianaMin : horasSinEstimacion * 60;
}

/** Un evento del sector visto desde el resumen del día. */
export interface EventoDelDia {
  tipoServicio: TipoServicio;
  inicioEn: Date;
  finEn: Date | null;
  confirmadoEn: Date;
  incompleto: boolean;
}

/**
 * Lo que pasó hoy en un sector, por servicio: los cortes confirmados hoy que ya terminaron (y su
 * suma) y el que sigue en curso, aunque haya empezado ayer. Los incompletos no tienen duración y no
 * cuentan. Solo devuelve los servicios con algo que contar.
 */
export function resumirActividad(
  eventos: readonly EventoDelDia[],
  inicioDia: Date,
): ActividadDia[] {
  return TIPOS_SERVICIO.flatMap((tipoServicio) => {
    const delServicio = eventos.filter((e) => e.tipoServicio === tipoServicio && !e.incompleto);
    const cerrados = delServicio.filter(
      (e) => e.finEn !== null && e.confirmadoEn.getTime() >= inicioDia.getTime(),
    );
    const enCurso = delServicio.find((e) => e.finEn === null);
    if (cerrados.length === 0 && !enCurso) return [];
    const minutosCerrados = cerrados.reduce(
      (total, e) => total + ((e.finEn as Date).getTime() - e.inicioEn.getTime()) / MS_MINUTO,
      0,
    );
    return [
      {
        tipoServicio,
        cerradosHoy: cerrados.length,
        minutosCerrados,
        enCursoDesde: enCurso?.inicioEn ?? null,
      },
    ];
  });
}

export interface HechosRecordatorio {
  ahora: Date;
  /** Los reportes abiertos del vecino, con el umbral de su sector y servicio. */
  reportesAbiertos: readonly {
    reporteId: string;
    tipoServicio: TipoServicio;
    inicioEn: Date;
    umbralMin: number;
  }[];
  /** Lo que pasó hoy en su sector, por servicio (`resumirActividad`). */
  actividadHoy: readonly ActividadDia[];
  /** Servicios con reportes sin confirmar ahora mismo en su sector. */
  sinConfirmar: readonly TipoServicio[];
}

export type Recordatorio =
  | { tipo: typeof TipoNotificacion.ReporteAbierto; tipoServicio: TipoServicio; reporteId: string }
  | { tipo: typeof TipoNotificacion.ResumenDia }
  | { tipo: typeof TipoNotificacion.PreguntaVecinos; tipoServicio: TipoServicio };

/**
 * Qué recordatorio merece un vecino que no entró hoy, en orden de utilidad. Si no hay nada que
 * contar, `null`: no se envía nada (un recordatorio vacío es spam).
 *
 * 1. Su reporte sigue abierto más de lo que suele durar un corte: cerrarlo da otro ciclo completo a
 *    la mediana (EST) y evita un ciclo incompleto (T-050).
 * 2. Hoy hubo cortes en su sector, o hay uno en curso: el resumen del día.
 * 3. Hay reportes sin confirmar de un servicio que él no reportó: la pregunta a los vecinos.
 */
export function elegirRecordatorio(h: HechosRecordatorio): Recordatorio | null {
  const vencido = h.reportesAbiertos
    .filter((r) => h.ahora.getTime() - r.inicioEn.getTime() >= r.umbralMin * MS_MINUTO)
    .sort((a, b) => a.inicioEn.getTime() - b.inicioEn.getTime())[0];
  if (vencido) {
    return {
      tipo: TipoNotificacion.ReporteAbierto,
      tipoServicio: vencido.tipoServicio,
      reporteId: vencido.reporteId,
    };
  }
  if (h.actividadHoy.some((a) => a.cerradosHoy > 0 || a.enCursoDesde !== null)) {
    return { tipo: TipoNotificacion.ResumenDia };
  }
  const reportados = new Set(h.reportesAbiertos.map((r) => r.tipoServicio));
  const pregunta = h.sinConfirmar.find((s) => !reportados.has(s));
  if (pregunta) return { tipo: TipoNotificacion.PreguntaVecinos, tipoServicio: pregunta };
  return null;
}
