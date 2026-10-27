import { randomUUID } from 'node:crypto';
import type { Sql } from 'postgres';
import { type IniciarReporteSolicitud, type ReporteDto, TipoServicio } from '@blackout/shared';
import type { PerfilResidente } from '../residentes/residentes.service';

/**
 * Seed de demo (T-061, D-027). El historial sale de `data/demo.csv` por el importador de campo
 * (T-044); aquí vive lo demás: el permiso para sembrar y los reportes en vivo que dejan el mapa con
 * un corte confirmado y otro "sin confirmar". Esos reportes pasan por `ReportesService.iniciar`, así
 * que el estado lo decide el consenso real (CON-01, CON-02), no un `update` a mano.
 */

/** Reportes en vivo de la demo: residentes con id fijo (idempotencia) y la hora del evento. */
export interface ReporteDemo {
  residenteId: string;
  /** Minutos respecto de la siembra (negativo = en el pasado). */
  minutos: number;
}

export interface CorteDemo {
  sectorNombre: string;
  tipoServicio: TipoServicio;
  reportes: ReporteDemo[];
}

/**
 * Luz en Suroeste: 3 vecinos dentro de la ventana de 30 min → corte confirmado (CON-02).
 * Agua en Calle 160: 2 vecinos → "2 reportes sin confirmar" con N = 3 (CON-01). Con la ventana de agua
 * (180 min) ese aviso se ve hasta unas 3 h después de sembrar; el corte confirmado dura hasta que los
 * reportes vencen (48 h, D-015).
 */
export const CORTES_DEMO: CorteDemo[] = [
  {
    sectorNombre: 'Guaparo Suroeste',
    tipoServicio: TipoServicio.Electricidad,
    reportes: [
      { residenteId: '00000000-0000-4000-8000-00000000de01', minutos: -40 },
      { residenteId: '00000000-0000-4000-8000-00000000de02', minutos: -32 },
      { residenteId: '00000000-0000-4000-8000-00000000de03', minutos: -25 },
    ],
  },
  {
    sectorNombre: 'Guaparo Calle 160',
    tipoServicio: TipoServicio.Agua,
    reportes: [
      { residenteId: '00000000-0000-4000-8000-00000000de04', minutos: -20 },
      { residenteId: '00000000-0000-4000-8000-00000000de05', minutos: -10 },
    ],
  },
];

/** Lo único de `ReportesService` que usa la demo; los tests pasan el servicio de la app. */
export interface IniciadorDeReportes {
  iniciar(
    perfil: PerfilResidente,
    id: string,
    solicitud: IniciarReporteSolicitud,
  ): Promise<ReporteDto>;
}

/**
 * Decide si se puede sembrar la demo en esta base. Devuelve el motivo para negarse, o null.
 * Una base local siempre se puede; una remota, salvo que parezca de producción. Las URL de Supabase
 * no dicen si el proyecto es el de staging o el de producción, así que la regla se apoya en
 * `NODE_ENV` y en el nombre; `--forzar` la salta a propósito.
 */
export function motivoParaNoSembrar(entorno: {
  url: string;
  nodeEnv?: string;
  forzar: boolean;
}): string | null {
  if (entorno.forzar) return null;
  let host: string;
  try {
    host = new URL(entorno.url).hostname;
  } catch {
    return 'DATABASE_URL no es una URL válida';
  }
  if (['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)) return null;
  if (entorno.nodeEnv === 'production') {
    return 'NODE_ENV=production: la demo mete datos sintéticos en la estimación';
  }
  if (/prod/i.test(entorno.url)) return 'la URL de la base parece de producción';
  return null;
}

/**
 * Crea (si no existen) los residentes de la demo en su sector. La ubicación es un punto interior
 * del polígono del sector, no la de nadie; igual que cualquier ubicación, nunca sale por la API.
 */
async function residentesDemo(sql: Sql, corte: CorteDemo): Promise<PerfilResidente[]> {
  const [sector] = await sql<{ id: number }[]>`
    select id from sectores where nombre = ${corte.sectorNombre}`;
  if (!sector) throw new Error(`No existe el sector ${corte.sectorNombre}: corre antes db:seed`);
  for (const r of corte.reportes) {
    await sql`
      insert into residentes (id, sector_id, ubicacion)
      select ${r.residenteId}, id, st_pointonsurface(geom)::geometry(Point, 4326)
      from sectores where id = ${sector.id}
      on conflict (id) do nothing`;
  }
  return corte.reportes.map((r) => ({
    id: r.residenteId,
    sectorId: sector.id,
    sectorNombre: corte.sectorNombre,
  }));
}

/**
 * Abre los reportes en vivo de `CORTES_DEMO`. Es idempotente: un residente de la demo que ya tiene un
 * reporte vivo (abierto y no vencido) de ese servicio no reporta de nuevo, así que correrlo dos veces
 * no duplica nada. Cuando los reportes vencen (D-015), volver a correrlo arma un corte nuevo.
 * Devuelve cuántos reportes creó.
 */
export async function abrirCortesDemo(
  sql: Sql,
  reportes: IniciadorDeReportes,
  ahora: Date,
): Promise<number> {
  let creados = 0;
  for (const corte of CORTES_DEMO) {
    const perfiles = await residentesDemo(sql, corte);
    for (const [i, perfil] of perfiles.entries()) {
      const vivos = await sql`
        select 1 from reportes
        where residente_id = ${perfil.id} and tipo_servicio = ${corte.tipoServicio}
          and fin_en is null and not vencido`;
      if (vivos.length > 0) continue;
      const ocurridoEn = new Date(ahora.getTime() + corte.reportes[i].minutos * 60_000);
      await reportes.iniciar(perfil, randomUUID(), {
        tipoServicio: corte.tipoServicio,
        ocurridoEn: ocurridoEn.toISOString(),
      });
      creados++;
    }
  }
  return creados;
}
