import { asc, eq, sql } from 'drizzle-orm';
import {
  CodigoError,
  type PinValidadoDto,
  type SectorAsignadoDto,
  TIPOS_SERVICIO,
} from '@blackout/shared';
import { ErrorNegocio } from '../comun/error-negocio';
import type { BaseDeDatos, Transaccion } from '../db/db.module';
import { estadoSector, lugares, municipios, sectores } from '../db/schema';
import { celdaDe, centroDe, hexagonoDe, nombreLibre } from './h3.puro';

// Del pin al sector (REG-01, REG-02, D-040). Son funciones sobre Drizzle y no un servicio de Nest
// para que los scripts de seed (demo) y los tests creen sectores igual que el registro.

export type Ejecutor = BaseDeDatos | Transaccion;

/**
 * Llave del candado que serializa la creación de sectores. Es la forma de un solo `bigint`, que no
 * choca con la de dos enteros del consenso (`pg_advisory_xact_lock(sector, servicio)`).
 */
const CANDADO_SECTORES = 70;

/** `ST_MakePoint` toma (lng, lat): el orden contrario al que se suele decir en voz alta. */
const punto = (lat: number, lng: number) => sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)`;

interface SectorExistente {
  id: number;
  nombre: string;
  municipio: string;
}

export interface UbicacionPin {
  celda: string;
  /** El municipio del sector: el que contiene el centro de la celda o, si cae fuera, el del pin. */
  municipio: { id: number; nombre: string };
  existente?: SectorExistente;
}

/**
 * Ubica el pin: 422 `PIN_FUERA_DE_ZONA` si no lo cubre ningún municipio (REG-02). `ST_Covers`
 * incluye el borde, así que un pin justo sobre el límite se acepta (REG-03, D-002).
 */
export async function ubicar(db: Ejecutor, lat: number, lng: number): Promise<UbicacionPin> {
  const celda = celdaDe(lat, lng);
  const centro = centroDe(celda);
  const cubreCentro = sql`ST_Covers(${municipios.geom}, ${punto(centro.lat, centro.lng)})`;
  const cubrePin = sql<boolean>`ST_Covers(${municipios.geom}, ${punto(lat, lng)})`;
  const candidatos = await db
    .select({ id: municipios.id, nombre: municipios.nombre, cubrePin })
    .from(municipios)
    .where(sql`${cubrePin} OR ${cubreCentro}`)
    .orderBy(sql`${cubreCentro} DESC`, asc(municipios.id));
  const [municipio] = candidatos;
  if (!municipio || !candidatos.some((m) => m.cubrePin)) {
    throw new ErrorNegocio(
      CodigoError.PinFueraDeZona,
      'El pin está fuera de la zona de cobertura (la Gran Valencia)',
    );
  }
  return {
    celda,
    municipio: { id: municipio.id, nombre: municipio.nombre },
    existente: await sectorDeCelda(db, celda),
  };
}

async function sectorDeCelda(db: Ejecutor, celda: string): Promise<SectorExistente | undefined> {
  const [sector] = await db
    .select({ id: sectores.id, nombre: sectores.nombre, municipio: municipios.nombre })
    .from(sectores)
    .innerJoin(municipios, eq(municipios.id, sectores.municipioId))
    .where(eq(sectores.celdaH3, celda))
    .limit(1);
  return sector;
}

/**
 * El nombre de un sector nuevo: el del lugar de OSM más cercano al centro de la celda, con la
 * distancia multiplicada por su peso (un barrio gana a un conjunto residencial algo más cerca). Si
 * no hay lugares sembrados, el del municipio. Si ya lo usa otro sector, se numera ("Guaparo 2").
 */
async function nombreNuevo(db: Ejecutor, celda: string, municipio: string): Promise<string> {
  const centro = centroDe(celda);
  const [lugar] = await db
    .select({ nombre: lugares.nombre })
    .from(lugares)
    .orderBy(
      sql`ST_Distance(${lugares.geom}::geography, ${punto(centro.lat, centro.lng)}::geography) * ${lugares.peso}`,
      asc(lugares.id),
    )
    .limit(1);
  const base = lugar?.nombre ?? municipio;
  const ocupados = await db
    .select({ nombre: sectores.nombre })
    .from(sectores)
    .where(sql`starts_with(${sectores.nombre}, ${base})`);
  return nombreLibre(
    base,
    ocupados.map((o) => o.nombre),
  );
}

/**
 * Lo que responde `POST /registro/validar-pin`: el sector de la celda o, si todavía no existe, el
 * nombre que tendría. No crea nada: el sector nace con el primer residente (D-040).
 */
export async function previsualizar(
  db: Ejecutor,
  lat: number,
  lng: number,
): Promise<PinValidadoDto> {
  const { celda, municipio, existente } = await ubicar(db, lat, lng);
  const geometria = hexagonoDe(celda);
  if (existente) {
    return {
      sectorId: existente.id,
      sectorNombre: existente.nombre,
      municipio: existente.municipio,
      geometria,
    };
  }
  return {
    sectorId: null,
    sectorNombre: await nombreNuevo(db, celda, municipio.nombre),
    municipio: municipio.nombre,
    geometria,
  };
}

/**
 * El sector de la celda del pin, creándolo (con sus filas de `estado_sector`) si es el primero.
 * Va dentro de la transacción del registro: si el residente no se crea, el sector tampoco. Dos
 * registros a la vez en una celda nueva se ordenan con el candado, que también evita que dos
 * sectores reciban el mismo nombre. `nombre` fija el nombre en vez del de OSM (tests y demo).
 */
export async function asegurarSector(
  tx: Transaccion,
  lat: number,
  lng: number,
  nombre?: string,
): Promise<SectorAsignadoDto> {
  const { celda, municipio, existente } = await ubicar(tx, lat, lng);
  const asignado = (s: SectorExistente): SectorAsignadoDto => ({
    sectorId: s.id,
    sectorNombre: s.nombre,
    municipio: s.municipio,
  });
  if (existente) return asignado(existente);

  await tx.execute(sql`select pg_advisory_xact_lock(${CANDADO_SECTORES}::bigint)`);
  const creadoMientras = await sectorDeCelda(tx, celda);
  if (creadoMientras) return asignado(creadoMientras);

  const nombreFinal = nombre ?? (await nombreNuevo(tx, celda, municipio.nombre));
  const [creado] = await tx
    .insert(sectores)
    .values({
      nombre: nombreFinal,
      celdaH3: celda,
      municipioId: municipio.id,
      geom: sql`ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(hexagonoDe(celda))}), 4326)`,
    })
    .returning({ id: sectores.id });
  if (!creado) throw new Error(`No se pudo crear el sector de la celda ${celda}`);
  await tx
    .insert(estadoSector)
    .values(TIPOS_SERVICIO.map((tipoServicio) => ({ sectorId: creado.id, tipoServicio })));
  return asignado({ id: creado.id, nombre: nombreFinal, municipio: municipio.nombre });
}
