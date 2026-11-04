import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, lt, or, sql } from 'drizzle-orm';
import { CodigoError, type PinValidadoDto, type SectorAsignadoDto } from '@blackout/shared';
import { ErrorNegocio } from '../comun/error-negocio';
import { RELOJ, type Reloj } from '../comun/reloj';
import { type BaseDeDatos, DB } from '../db/db.module';
import { municipios, residentes, sectores } from '../db/schema';
import { asegurarSector, previsualizar } from '../sectores/ubicacion';

export interface PerfilResidente {
  id: string;
  sectorId: number;
  sectorNombre: string;
  municipio: string;
}

/** `ultimo_ingreso` se actualiza a lo sumo cada 15 min. */
const INGRESO_RESOLUCION_MS = 15 * 60_000;

/** `ST_MakePoint` toma (lng, lat): el orden contrario al que se suele decir en voz alta. */
const punto = (lat: number, lng: number) => sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)`;

@Injectable()
export class ResidentesService {
  constructor(
    @Inject(DB) private readonly db: BaseDeDatos,
    @Inject(RELOJ) private readonly reloj: Reloj,
  ) {}

  /**
   * Anota que el vecino abrió la app (T-072, D-042): los recordatorios solo van a quien no entró en
   * el día. Escribe a lo sumo una vez cada 15 min, para no convertir cada lectura en una escritura.
   */
  async registrarIngreso(id: string): Promise<void> {
    const ahora = this.reloj();
    await this.db
      .update(residentes)
      .set({ ultimoIngreso: ahora })
      .where(
        and(
          eq(residentes.id, id),
          or(
            isNull(residentes.ultimoIngreso),
            lt(residentes.ultimoIngreso, new Date(ahora.getTime() - INGRESO_RESOLUCION_MS)),
          ),
        ),
      );
  }

  /**
   * El sector en el que quedaría el pin (su hexágono H3), o 422 `PIN_FUERA_DE_ZONA` si cae fuera
   * de la Gran Valencia (REG-02, D-040). No crea nada.
   */
  validarPin(lat: number, lng: number): Promise<PinValidadoDto> {
    return previsualizar(this.db, lat, lng);
  }

  /**
   * Crea el perfil del residente (una sola vez) y, si es el primero de su celda, el sector. Todo en
   * una transacción: con un 409 el sector nuevo tampoco queda. Nunca devuelve el pin.
   */
  registrar(id: string, lat: number, lng: number): Promise<SectorAsignadoDto> {
    return this.db.transaction(async (tx) => {
      const sector = await asegurarSector(tx, lat, lng);
      const creados = await tx
        .insert(residentes)
        .values({
          id,
          sectorId: sector.sectorId,
          ubicacion: punto(lat, lng),
          ultimoIngreso: this.reloj(),
        })
        .onConflictDoNothing()
        .returning({ id: residentes.id });
      if (creados.length === 0) {
        throw new ErrorNegocio(
          CodigoError.ResidenteYaRegistrado,
          'El residente ya está registrado',
        );
      }
      return sector;
    });
  }

  /** El perfil sin la ubicación (NF-06), o `undefined` si el usuario de Auth aún no completó el registro. */
  async perfil(id: string): Promise<PerfilResidente | undefined> {
    const [fila] = await this.db
      .select({
        id: residentes.id,
        sectorId: residentes.sectorId,
        sectorNombre: sectores.nombre,
        municipio: municipios.nombre,
      })
      .from(residentes)
      .innerJoin(sectores, eq(sectores.id, residentes.sectorId))
      .innerJoin(municipios, eq(municipios.id, sectores.municipioId))
      .where(eq(residentes.id, id))
      .limit(1);
    return fila;
  }
}
