import type { Sql } from 'postgres';
import type { ReporteEsperado } from './simulacion';

export interface Diferencia {
  id: string;
  campo: 'residenteId' | 'tipoServicio' | 'inicioEn' | 'finEn';
  esperado: string | null;
  real: string | null;
}

export interface ResultadoVerificacion {
  esperados: number;
  enBd: number;
  /** Reportes que el cliente dio por guardados y no están en la BD. */
  perdidos: string[];
  /**
   * Filas de más: ids que el cliente nunca generó y filas repetidas de un mismo evento (mismo
   * residente, servicio y hora de inicio).
   */
  duplicados: string[];
  /** Reportes guardados con otro contenido (p. ej. la hora de envío en lugar de la del evento). */
  diferencias: Diferencia[];
}

interface FilaReporte {
  id: string;
  residente_id: string;
  tipo_servicio: string;
  inicio_en: Date | string;
  fin_en: Date | string | null;
}

/** postgres-js devuelve `timestamptz` como `Date`; se normaliza por si llega como texto. */
const iso = (d: Date | string | null) => (d === null ? null : new Date(d).toISOString());

/**
 * Compara lo que el cliente cree guardado con lo que hay en `reportes` para esos residentes
 * (T-054, NF-04): 0 pérdidas, 0 duplicados y la hora del evento intacta (OFF-03). `previos` son
 * los ids que esos residentes ya tenían antes de la corrida (en una base que no se vació).
 */
export async function verificar(
  sql: Sql,
  esperados: ReporteEsperado[],
  residentes: string[],
  previos: ReadonlySet<string> = new Set(),
): Promise<ResultadoVerificacion> {
  const filas =
    residentes.length === 0
      ? []
      : (
          await sql<FilaReporte[]>`
            select id, residente_id, tipo_servicio, inicio_en, fin_en
            from reportes
            where residente_id in ${sql(residentes)}`
        ).filter((f) => !previos.has(f.id));

  const porId = new Map(filas.map((f) => [f.id, f]));
  const idsEsperados = new Set(esperados.map((e) => e.id));
  const perdidos = esperados.filter((e) => !porId.has(e.id)).map((e) => e.id);

  const duplicados = filas.filter((f) => !idsEsperados.has(f.id)).map((f) => f.id);
  const vistos = new Map<string, string>();
  for (const f of filas) {
    const clave = `${f.residente_id}/${f.tipo_servicio}/${iso(f.inicio_en)}`;
    const otro = vistos.get(clave);
    if (otro === undefined) vistos.set(clave, f.id);
    else if (!duplicados.includes(f.id)) duplicados.push(f.id);
  }

  const diferencias: Diferencia[] = [];
  for (const e of esperados) {
    const f = porId.get(e.id);
    if (!f) continue;
    const comparar = (campo: Diferencia['campo'], esperado: string | null, real: string | null) => {
      if (esperado !== real) diferencias.push({ id: e.id, campo, esperado, real });
    };
    comparar('residenteId', e.residenteId, f.residente_id);
    comparar('tipoServicio', e.tipoServicio, f.tipo_servicio);
    comparar('inicioEn', e.inicioEn, iso(f.inicio_en));
    comparar('finEn', e.finEn, iso(f.fin_en));
  }

  return { esperados: esperados.length, enBd: filas.length, perdidos, duplicados, diferencias };
}

/** Resumen de una línea por resultado, para la salida del script. */
export function resumirVerificacion(v: ResultadoVerificacion): string {
  return (
    `esperados ${v.esperados} · en la BD ${v.enBd} · pérdidas ${v.perdidos.length} · ` +
    `duplicados ${v.duplicados.length} · diferencias ${v.diferencias.length}`
  );
}
