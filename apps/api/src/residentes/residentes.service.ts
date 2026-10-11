import { Inject, Injectable } from '@nestjs/common';
import { asc, eq, sql } from 'drizzle-orm';
import { CodigoError, type SectorAsignadoDto } from '@blackout/shared';
import { ErrorNegocio } from '../comun/error-negocio';
import { type BaseDeDatos, DB } from '../db/db.module';
import { residentes, sectores } from '../db/schema';

export interface PerfilResidente {
  id: string;
  sectorId: number;
  sectorNombre: string;
}

/** `ST_MakePoint` toma (lng, lat): el orden contrario al que se suele decir en voz alta. */
const punto = (lat: number, lng: number) => sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)`;

@Injectable()
export class ResidentesService {
  constructor(@Inject(DB) private readonly db: BaseDeDatos) {}

  /**
   * Sector que contiene el pin, o 422 `PIN_FUERA_DE_GUAPARO`. Usa `ST_Covers`, que incluye el borde,
   * y si el pin cae justo entre dos sectores gana el de menor id: la regla siempre da el mismo
   * resultado (REG-03, D-002).
   */
  async sectorDelPin(lat: number, lng: number): Promise<SectorAsignadoDto> {
    const [sector] = await this.db
      .select({ sectorId: sectores.id, sectorNombre: sectores.nombre })
      .from(sectores)
      .where(sql`ST_Covers(${sectores.geom}, ${punto(lat, lng)})`)
      .orderBy(asc(sectores.id))
      .limit(1);
    if (!sector) {
      throw new ErrorNegocio(
        CodigoError.PinFueraDeGuaparo,
        'El pin está fuera de la urbanización Guaparo',
      );
    }
    return sector;
  }

  /** Crea el perfil del residente (una sola vez). 409 si ya existe. Nunca devuelve el pin. */
  async registrar(id: string, lat: number, lng: number): Promise<SectorAsignadoDto> {
    const sector = await this.sectorDelPin(lat, lng);
    const creados = await this.db
      .insert(residentes)
      .values({ id, sectorId: sector.sectorId, ubicacion: punto(lat, lng) })
      .onConflictDoNothing()
      .returning({ id: residentes.id });
    if (creados.length === 0) {
      throw new ErrorNegocio(CodigoError.ResidenteYaRegistrado, 'El residente ya está registrado');
    }
    return sector;
  }

  /** El perfil sin la ubicación (NF-06), o `undefined` si el usuario de Auth aún no completó el registro. */
  async perfil(id: string): Promise<PerfilResidente | undefined> {
    const [fila] = await this.db
      .select({ id: residentes.id, sectorId: residentes.sectorId, sectorNombre: sectores.nombre })
      .from(residentes)
      .innerJoin(sectores, eq(sectores.id, residentes.sectorId))
      .where(eq(residentes.id, id))
      .limit(1);
    return fila;
  }
}
