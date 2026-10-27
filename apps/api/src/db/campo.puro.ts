// Validación del CSV del dataset de campo (T-044). Lógica pura: no toca la base y NUNCA llama a
// `Date.now()`; recibe los sectores y `ahora` como parámetros, así los tests fijan todo.
import { TIPOS_SERVICIO, type TipoServicio } from '@blackout/shared';

/** Cabecera obligatoria, en este orden. */
export const COLUMNAS_CAMPO = ['sector', 'tipo_servicio', 'inicio', 'fin'] as const;

/** Un ciclo completo del dataset, listo para insertarse en `eventos_sector`. */
export interface FilaCampo {
  /** Línea del archivo (1 = la cabecera), para los mensajes. */
  linea: number;
  sectorId: number;
  tipoServicio: TipoServicio;
  inicio: Date;
  fin: Date;
}

export interface FilaInvalida {
  linea: number;
  motivo: string;
}

export interface ResultadoValidacion {
  validas: FilaCampo[];
  invalidas: FilaInvalida[];
}

interface LineaCsv {
  linea: number;
  campos: string[];
}

/**
 * Parte un CSV en campos. Admite comillas dobles (con `""` como comilla escapada), separador `,`,
 * finales de línea LF o CRLF y un BOM inicial. Ignora las líneas vacías y las que empiezan por `#`
 * (comentarios). No admite saltos de línea dentro de un campo: este formato no los necesita.
 */
export function leerCsv(texto: string): LineaCsv[] {
  const sinBom = texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto;
  const lineas = sinBom.split(/\r?\n/);
  const resultado: LineaCsv[] = [];
  lineas.forEach((cruda, i) => {
    if (cruda.trim() === '' || cruda.trimStart().startsWith('#')) return;
    resultado.push({ linea: i + 1, campos: partirLinea(cruda) });
  });
  return resultado;
}

function partirLinea(linea: string): string[] {
  const campos: string[] = [];
  let actual = '';
  let entreComillas = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (entreComillas) {
      if (c === '"' && linea[i + 1] === '"') {
        actual += '"';
        i++;
      } else if (c === '"') {
        entreComillas = false;
      } else {
        actual += c;
      }
    } else if (c === '"') {
      entreComillas = true;
    } else if (c === ',') {
      campos.push(actual.trim());
      actual = '';
    } else {
      actual += c;
    }
  }
  campos.push(actual.trim());
  return campos;
}

// ISO 8601 con fecha, hora y zona obligatoria (`Z` o `±hh:mm`): sin zona, la hora sería ambigua.
const ISO_CON_ZONA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

/** Convierte un ISO 8601 con zona en `Date`; `null` si falta la zona o no es una fecha real. */
export function leerFechaConZona(texto: string): Date | null {
  if (!ISO_CON_ZONA.test(texto)) return null;
  const fecha = new Date(texto);
  if (Number.isNaN(fecha.getTime())) return null;
  // `new Date` acepta el 31 de febrero y lo corre al 3 de marzo: se rechaza comparando el día.
  const [anio, mes, dia] = texto.slice(0, 10).split('-').map(Number);
  const soloDia = new Date(Date.UTC(anio, mes - 1, dia));
  return soloDia.getUTCMonth() === mes - 1 && soloDia.getUTCDate() === dia ? fecha : null;
}

/** Clave de un nombre de sector: sin espacios de más y sin distinguir mayúsculas. */
export const claveSector = (nombre: string) => nombre.trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * Valida cada fila del CSV. Una fila es válida si su sector existe (por nombre, sin distinguir
 * mayúsculas), el servicio es `agua` o `electricidad`, las dos horas son ISO 8601 con zona, ninguna
 * está en el futuro y `fin > inicio` (un ciclo completo; nunca una duración negativa ni cero).
 * Dentro del archivo, una fila idéntica a otra anterior es repetida y una que se solapa con otra
 * del mismo sector y servicio se rechaza: un sector no puede tener dos cortes a la vez.
 * Si la cabecera no es `sector,tipo_servicio,inicio,fin`, lanza: el archivo entero está mal.
 */
export function validarCampo(
  texto: string,
  sectores: ReadonlyMap<string, number>,
  ahora: Date,
): ResultadoValidacion {
  const [cabecera, ...filas] = leerCsv(texto);
  const esperada = COLUMNAS_CAMPO.join(',');
  if (!cabecera || cabecera.campos.map((c) => c.toLowerCase()).join(',') !== esperada) {
    throw new Error(`El CSV debe empezar con la cabecera "${esperada}"`);
  }

  const validas: FilaCampo[] = [];
  const invalidas: FilaInvalida[] = [];
  for (const { linea, campos } of filas) {
    const motivo = motivoInvalida(campos, sectores, ahora, validas);
    if (typeof motivo === 'string') invalidas.push({ linea, motivo });
    else validas.push({ linea, ...motivo });
  }
  return { validas, invalidas };
}

function motivoInvalida(
  campos: string[],
  sectores: ReadonlyMap<string, number>,
  ahora: Date,
  anteriores: FilaCampo[],
): string | Omit<FilaCampo, 'linea'> {
  if (campos.length !== COLUMNAS_CAMPO.length) {
    return `Se esperaban ${COLUMNAS_CAMPO.length} columnas y hay ${campos.length}`;
  }
  const [nombre, servicio, textoInicio, textoFin] = campos;

  const sectorId = sectores.get(claveSector(nombre));
  if (sectorId === undefined) return `El sector "${nombre}" no existe`;

  const tipoServicio = servicio.toLowerCase() as TipoServicio;
  if (!TIPOS_SERVICIO.includes(tipoServicio)) {
    return `El servicio "${servicio}" no es válido (agua o electricidad)`;
  }

  const inicio = leerFechaConZona(textoInicio);
  if (!inicio) return `El inicio "${textoInicio}" no es una fecha ISO 8601 con zona`;
  if (textoFin === '') return 'Falta el fin: solo se cargan ciclos completos';
  const fin = leerFechaConZona(textoFin);
  if (!fin) return `El fin "${textoFin}" no es una fecha ISO 8601 con zona`;
  if (fin.getTime() > ahora.getTime()) return 'El fin está en el futuro';
  if (fin.getTime() <= inicio.getTime()) return 'El fin debe ser posterior al inicio';

  for (const otra of anteriores) {
    if (otra.sectorId !== sectorId || otra.tipoServicio !== tipoServicio) continue;
    if (otra.inicio.getTime() === inicio.getTime() && otra.fin.getTime() === fin.getTime()) {
      return `Repite la línea ${otra.linea}`;
    }
    if (inicio < otra.fin && otra.inicio < fin) return `Se solapa con la línea ${otra.linea}`;
  }
  return { sectorId, tipoServicio, inicio, fin };
}
