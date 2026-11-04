// Redacción de las notificaciones con la voz B, la del vecino valenciano (T-072, D-042). Lógica pura.
//
// Reglas fijas: tuteo, hora de 24 h de Caracas, el nombre corto del sector, y toda cifra de
// duración con «aprox.» y su n («según 12 cortes registrados»). Es una estimación estadística:
// nunca se habla de predicción. Sin datos suficientes no hay cifra (EST-04).
import {
  AccionNotificacion,
  type EstimacionDto,
  type NotificacionPushDto,
  TipoNotificacion,
  type TipoServicio,
} from '@blackout/shared';
import { inicioDelDia } from './horario.puro';

const MS_MINUTO = 60_000;
const MS_DIA = 24 * 60 * MS_MINUTO;
const DESFASE_CARACAS_MS = -4 * 60 * MS_MINUTO;

const dos = (n: number) => String(n).padStart(2, '0');

/** «14:20»: 24 h, hora de Caracas (como `hora()` del canon del frontend). */
export function hora(t: Date): string {
  const local = new Date(t.getTime() + DESFASE_CARACAS_MS);
  return `${dos(local.getUTCHours())}:${dos(local.getUTCMinutes())}`;
}

/** 240 → «4 h»; 220 → «3 h 40 min»; 45 → «45 min» (como `duracion()` del canon). */
export function duracion(minutos: number): string {
  const m = Math.max(0, Math.round(minutos));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const resto = m % 60;
  return resto === 0 ? `${h} h` : `${h} h ${resto} min`;
}

/** «las 14:20», «ayer a las 14:20» o «el 01/11 a las 14:20», según el día de Caracas. */
export function cuando(t: Date, ahora: Date): string {
  const dias = Math.round((inicioDelDia(ahora).getTime() - inicioDelDia(t).getTime()) / MS_DIA);
  if (dias === 0) return `las ${hora(t)}`;
  if (dias === 1) return `ayer a las ${hora(t)}`;
  const local = new Date(t.getTime() + DESFASE_CARACAS_MS);
  return `el ${dos(local.getUTCDate())}/${dos(local.getUTCMonth() + 1)} a las ${hora(t)}`;
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Cómo se nombra cada servicio. El agua «llega»; la luz «vuelve». */
const SERVICIO = {
  electricidad: { con: 'la luz', sin: 'luz', vuelve: 'volvió', volver: 'volver', Vuelve: 'Volvió' },
  agua: { con: 'el agua', sin: 'agua', vuelve: 'llegó', volver: 'llegar', Vuelve: 'Llegó' },
} as const satisfies Record<TipoServicio, Record<string, string>>;

const capital = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

/** «según 12 cortes registrados»: el n acompaña siempre a la cifra (EST, canon §7.1). */
const segun = (n: number) => `según ${plural(n, 'corte registrado', 'cortes registrados')}`;

/** Lo que pasó hoy con un servicio, para el resumen del día. */
export interface ActividadDia {
  tipoServicio: TipoServicio;
  /** Cortes confirmados hoy que ya terminaron, y cuánto sumaron. */
  cerradosHoy: number;
  minutosCerrados: number;
  /** Inicio del corte que sigue en curso, si hay uno. */
  enCursoDesde: Date | null;
}

export interface DatosRedaccion {
  id: string;
  tipo: TipoNotificacion;
  sectorId: number;
  sectorNombre: string;
  tipoServicio: TipoServicio | null;
  ahora: Date;
  /** Se envía dentro de las horas silenciosas (solo pasa con «llegó el agua» a quien lo pidió). */
  deNoche?: boolean;
  evento?: { inicioEn: Date; finEn: Date | null };
  vecinos?: number;
  aporto?: boolean;
  estimacion?: EstimacionDto;
  /** Sectores vecinos (anillo H3) sin el mismo servicio ahora mismo. */
  vecinosSinServicio?: number;
  reporteInicioEn?: Date;
  actividad?: readonly ActividadDia[];
  imagen?: string | null;
}

/** Título y cuerpo de cada tipo. Lanza si faltan los datos que ese tipo necesita. */
export function redactar(d: DatosRedaccion): NotificacionPushDto {
  const { titulo, cuerpo } = textos(d);
  const conServicio = d.tipoServicio !== null;
  const esPregunta = d.tipo === TipoNotificacion.PreguntaVecinos;
  return {
    id: d.id,
    tipo: d.tipo,
    titulo,
    cuerpo,
    etiqueta: conServicio ? `corte-${d.sectorId}-${d.tipoServicio}` : `resumen-${d.sectorId}`,
    url: ruta(d),
    renotificar: true,
    tipoServicio: d.tipoServicio,
    imagen: d.imagen ?? null,
    acciones: esPregunta
      ? [
          { accion: AccionNotificacion.SeFue, titulo: 'Se fue' },
          { accion: AccionNotificacion.AquiSiHay, titulo: 'Aquí sí hay' },
        ]
      : [],
  };
}

function ruta(d: DatosRedaccion): string {
  const n = `n=${encodeURIComponent(d.id)}`;
  switch (d.tipo) {
    case TipoNotificacion.PreguntaVecinos:
    case TipoNotificacion.ReporteAbierto:
      return `/reportar?servicio=${d.tipoServicio}&${n}`;
    case TipoNotificacion.ResumenDia:
      return `/panel?${n}`;
    default:
      return `/?${n}`;
  }
}

function servicioDe(d: DatosRedaccion) {
  if (!d.tipoServicio) throw new Error(`${d.tipo} necesita tipoServicio`);
  return SERVICIO[d.tipoServicio];
}

function textos(d: DatosRedaccion): { titulo: string; cuerpo: string } {
  switch (d.tipo) {
    case TipoNotificacion.CorteConfirmado:
      return corteConfirmado(d);
    case TipoNotificacion.ServicioRestablecido:
      return servicioRestablecido(d);
    case TipoNotificacion.PreguntaVecinos: {
      const s = servicioDe(d);
      return {
        titulo: `¿Y ${s.con} por tu casa?`,
        cuerpo: `Hay reportes sin confirmar en ${d.sectorNombre}. Cuéntanos cómo está, sea cual sea la respuesta.`,
      };
    }
    case TipoNotificacion.ReporteAbierto: {
      const s = servicioDe(d);
      if (!d.reporteInicioEn) throw new Error('reporte_abierto necesita reporteInicioEn');
      return {
        titulo: `Oye, ¿ya ${s.vuelve} ${s.con}?`,
        cuerpo:
          `Tu reporte sigue abierto desde ${cuando(d.reporteInicioEn, d.ahora)}. ` +
          `Si ya ${s.vuelve}, avísales a tus vecinos: así la estimación sale mejor.`,
      };
    }
    case TipoNotificacion.ResumenDia:
      return resumenDia(d);
  }
}

function corteConfirmado(d: DatosRedaccion): { titulo: string; cuerpo: string } {
  const s = servicioDe(d);
  if (!d.evento) throw new Error('corte_confirmado necesita evento');
  const vecinos = d.vecinos ?? 0;
  const desde = `Desde las ${hora(d.evento.inicioEn)}`;
  let confirmacion: string;
  if (d.aporto) {
    const otros = vecinos - 1;
    confirmacion =
      otros > 0
        ? `${desde}. Tu reporte y el de ${plural(otros, 'vecino', 'vecinos')} más lo confirmaron.`
        : `${desde}. Tu reporte lo confirmó.`;
  } else {
    confirmacion = `${desde}, lo ${vecinos === 1 ? 'confirmó' : 'confirmaron'} ${plural(vecinos, 'vecino', 'vecinos')}.`;
  }
  const partes = [confirmacion];
  if (d.estimacion) {
    partes.push(
      d.estimacion.suficiente
        ? `Suele ${s.volver} en aprox. ${duracion(d.estimacion.medianaMin)}, ${segun(d.estimacion.n)}.`
        : 'Todavía no hay datos suficientes para estimar cuánto dura.',
    );
  }
  if (d.vecinosSinServicio && d.vecinosSinServicio > 0) {
    partes.push(
      `También sin ${s.sin} en ${plural(d.vecinosSinServicio, 'sector vecino', 'sectores vecinos')}.`,
    );
  }
  return { titulo: `Se fue ${s.con} en ${d.sectorNombre}`, cuerpo: partes.join(' ') };
}

function servicioRestablecido(d: DatosRedaccion): { titulo: string; cuerpo: string } {
  const s = servicioDe(d);
  const esAgua = d.tipoServicio === 'agua';
  const titulo = d.deNoche
    ? `Perdón la hora: ¡${s.vuelve} ${s.con} a ${d.sectorNombre}!`
    : `¡${s.Vuelve} ${s.con} a ${d.sectorNombre}!`;
  const partes: string[] = [];
  if (esAgua) partes.push('Aprovecha y llena los tobos.');
  const fin = d.evento?.finEn;
  if (d.evento && fin) {
    const minutos = (fin.getTime() - d.evento.inicioEn.getTime()) / MS_MINUTO;
    partes.push(`${s.Vuelve} a las ${hora(fin)}, después de ${duracion(minutos)}.`);
    if (d.estimacion?.suficiente) {
      const razon = minutos / d.estimacion.medianaMin;
      const comparacion =
        razon < 0.9 ? 'menos de lo habitual' : razon > 1.1 ? 'más de lo habitual' : 'lo habitual';
      partes.push(
        `Esta vez duró ${comparacion} (aprox. ${duracion(d.estimacion.medianaMin)}, ${segun(d.estimacion.n)}).`,
      );
    }
  }
  if (d.aporto) partes.push('Gracias por avisar.');
  return { titulo, cuerpo: partes.join(' ') };
}

function resumenDia(d: DatosRedaccion): { titulo: string; cuerpo: string } {
  const frases = (d.actividad ?? []).flatMap((a) => {
    const s = SERVICIO[a.tipoServicio];
    const partes: string[] = [];
    if (a.cerradosHoy > 0) {
      partes.push(
        `${s.con} se fue ${plural(a.cerradosHoy, 'vez', 'veces')} (${duracion(a.minutosCerrados)} en total)`,
      );
    }
    if (a.enCursoDesde) {
      const sigue = `sigue sin ${s.volver} desde ${cuando(a.enCursoDesde, d.ahora)}`;
      partes.push(partes.length > 0 ? `y ahora ${sigue}` : `${s.con} ${sigue}`);
    }
    return partes.length > 0 ? [partes.join(' ')] : [];
  });
  if (frases.length === 0) throw new Error('resumen_dia necesita actividad');
  return {
    titulo: `Hoy en ${d.sectorNombre}`,
    cuerpo: `${capital(frases.join('; '))}. Échale un ojo al mapa.`,
  };
}
