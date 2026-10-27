import { TipoServicio, type EventoSectorDto } from '@blackout/shared';
import { estadoVisual } from '../dominio/estado-visual';
import type { AccionAviso, AvisoCola, EstadoSector, EstadoVisual } from '../dominio/tipos';
import { diaRelativo, duracion, hora } from '../utils/formato';

// Textos del mapa y de su detalle (CANON §4.6 y §7). Funciones puras: se prueban sin React.

interface SectorNombrado {
  id: number;
  nombre: string;
}

const filaDe = (
  estados: readonly EstadoSector[] | undefined,
  sectorId: number,
  servicio: TipoServicio,
): EstadoSector | undefined =>
  estados?.find((e) => e.sectorId === sectorId && e.tipoServicio === servicio);

/**
 * Nombre del sector sobre el mapa: dentro de Guaparo, la urbanización sobra ("Guaparo Noroeste" →
 * "Noroeste") y solo hace que las etiquetas vecinas se pisen. El detalle y el `aria-label` usan el
 * nombre completo.
 */
export const nombreEnMapa = (nombre: string): string => nombre.replace(/^Guaparo\s+(?=\S)/i, '');

/** El estado que se dibuja para un sector y servicio; sin filas, "sin datos" (CANON §3). */
export const estadoDeSector = (
  estados: readonly EstadoSector[] | undefined,
  sectorId: number,
  servicio: TipoServicio,
): EstadoVisual => estadoVisual(filaDe(estados, sectorId, servicio));

const FRASE_MAPA: Record<EstadoVisual, string> = {
  'con-servicio': 'con servicio',
  'sin-confirmar': 'con reportes sin confirmar',
  'sin-servicio': 'sin servicio',
  'sin-datos': 'sin datos',
};

/** `aria-label` del mapa: "Mapa de sectores: Sector 1 sin servicio, Sector 2 con servicio, …". */
export function etiquetaMapa(
  sectores: readonly SectorNombrado[],
  estados: readonly EstadoSector[] | undefined,
  servicio: TipoServicio,
): string {
  if (sectores.length === 0) return 'Mapa de sectores';
  const partes = sectores.map(
    (s) => `${s.nombre} ${FRASE_MAPA[estadoDeSector(estados, s.id, servicio)]}`,
  );
  return `Mapa de sectores: ${partes.join(', ')}`;
}

const ADJETIVO: Record<TipoServicio, string> = {
  [TipoServicio.Electricidad]: 'eléctrico',
  [TipoServicio.Agua]: 'de agua',
};

const fraseCambio = (estado: EstadoVisual, servicio: TipoServicio): string => {
  switch (estado) {
    case 'sin-servicio':
      return `sin servicio ${ADJETIVO[servicio]}`;
    case 'con-servicio':
      return `volvió el servicio ${ADJETIVO[servicio]}`;
    case 'sin-confirmar':
      return `reportes sin confirmar de ${servicio === TipoServicio.Agua ? 'agua' : 'luz'}`;
    case 'sin-datos':
      return 'sin datos';
  }
};

/**
 * Una frase por cada fila que cambió de estado visible entre dos lecturas ("Sector 2: sin servicio
 * eléctrico"), para la región `aria-live` (CANON §4.6). La primera carga no anuncia nada, y lo que
 * no cambió tampoco.
 */
export function anunciosDeCambio(
  previos: readonly EstadoSector[] | undefined,
  actuales: readonly EstadoSector[] | undefined,
  nombre: (sectorId: number) => string,
): string[] {
  if (!previos || !actuales) return [];
  return actuales.flatMap((fila) => {
    const antes = filaDe(previos, fila.sectorId, fila.tipoServicio);
    if (!antes) return [];
    const ahora = estadoVisual(fila);
    return estadoVisual(antes) === ahora
      ? []
      : [`${nombre(fila.sectorId)}: ${fraseCambio(ahora, fila.tipoServicio)}`];
  });
}

/** Minutos de un corte cerrado: los de la API o, si faltan, la resta de las horas. */
export const duracionDe = (evento: EventoSectorDto): number | null =>
  evento.duracionMin ??
  (evento.finEn
    ? Math.round((Date.parse(evento.finEn) - Date.parse(evento.inicioEn)) / 60_000)
    : null);

/**
 * La línea bajo el título del detalle (A §3 y §5). Sin servicio: "Desde las 14:20" (P2, el número
 * de vecinos que confirmaron, no existe en la API). Sin confirmar: "2 de 3 reportes". Con
 * servicio: "Última interrupción: hace 2 días, duró 5 h".
 */
export function lineaEstado(opciones: {
  estado: EstadoVisual;
  fila: EstadoSector | undefined;
  eventos: readonly EventoSectorDto[] | undefined;
  consensoN: number;
  ahora: string;
}): string {
  const { estado, fila, eventos, consensoN, ahora } = opciones;
  switch (estado) {
    case 'sin-servicio':
      return fila?.desde ? `Desde las ${hora(fila.desde)}` : 'Corte confirmado por los vecinos';
    case 'sin-confirmar':
      return `${fila?.reportesSinConfirmar ?? 0} de ${consensoN} reportes`;
    case 'sin-datos':
      return 'No hay datos guardados de este sector todavía';
    case 'con-servicio': {
      const ultimo = eventos?.find((e) => e.finEn !== null);
      const minutos = ultimo ? duracionDe(ultimo) : null;
      if (!ultimo || minutos === null) return 'Sin interrupciones registradas';
      const cuando = diaRelativo(ultimo.inicioEn, ahora);
      return `Última interrupción: ${cuando.charAt(0).toLowerCase()}${cuando.slice(1)}, duró ${duracion(minutos)}`;
    }
  }
}

const NOMBRE_EN_FRASE: Record<TipoServicio, string> = {
  [TipoServicio.Electricidad]: 'la luz',
  [TipoServicio.Agua]: 'el agua',
};

/** "Se fue la luz" / "Volvió el agua": la acción de un aviso de la cola. */
export const textoAccion = (servicio: TipoServicio, accion: AccionAviso): string =>
  `${accion === 'inicio' ? 'Se fue' : 'Volvió'} ${NOMBRE_EN_FRASE[servicio]}`;

/**
 * Bajo "Sin luz": el corte se confirmó porque lo reportaron al menos N vecinos distintos (CON-01).
 * El número exacto (P2) no está en la API, así que se dice el mínimo, que siempre es cierto.
 */
export const textoConsenso = (consensoN: number): string =>
  `Confirmado por al menos ${consensoN} vecinos`;

/** Minutos que lleva un corte en curso, desde su inicio hasta ahora; nunca negativos. */
export const minutosDesde = (desde: string, ahora: string): number =>
  Math.max(0, Math.floor((Date.parse(ahora) - Date.parse(desde)) / 60_000));

/** Botón principal según el estado del sector (CANON §7.1). */
export const textoBotonPrincipal = (estado: EstadoVisual, servicio: TipoServicio): string =>
  estado === 'sin-servicio'
    ? `Ya volvió ${NOMBRE_EN_FRASE[servicio]}`
    : `Se fue ${NOMBRE_EN_FRASE[servicio]}`;

/** "Tu aviso «Volvió la luz» (15:04) está pendiente de envío" (A §3). */
export const textoAvisoPendiente = (aviso: AvisoCola): string =>
  `Tu aviso «${textoAccion(aviso.tipoServicio, aviso.accion)}» (${hora(aviso.ocurridoEn)}) está pendiente de envío`;

/** "09:10 a 12:40" para un corte cerrado; "Desde las 14:20" para el que sigue en curso. */
export const intervaloCorte = (evento: EventoSectorDto): string =>
  evento.finEn
    ? `${hora(evento.inicioEn)} a ${hora(evento.finEn)}`
    : `Desde las ${hora(evento.inicioEn)}`;
