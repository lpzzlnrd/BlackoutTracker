import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sql as sqlDrizzle } from 'drizzle-orm';
import type { TransactionSql } from 'postgres';
import { estadoSector, eventosSector, reportes, residentes, sectores } from '../src/db/schema';
import { abrirBd, type BdTest, codigoPg, cuadrado, limpiar } from './bd';

const SIN_PERMISO = '42501';
const TABLAS_PRIVADAS = ['sectores', 'residentes', 'reportes', 'eventos_sector'] as const;
const ROLES = ['anon', 'authenticated'] as const;

/** Sirve para sacar un valor de una transacción que se revierte siempre (los GRANT y los CREATE no sobreviven). */
class Revertir {
  constructor(readonly valor: unknown) {}
}

describe('RLS deny-all y Realtime (T-011, NF-06)', () => {
  let bd: BdTest;

  beforeAll(() => {
    bd = abrirBd();
  });
  afterAll(() => bd.sql.end());

  async function enTransaccion<T>(fn: (tx: TransactionSql) => Promise<T>): Promise<T> {
    try {
      await bd.sql.begin(async (tx) => {
        throw new Revertir(await fn(tx));
      });
    } catch (e) {
      if (e instanceof Revertir) return e.valor as T;
      throw e;
    }
    throw new Error('inalcanzable');
  }

  /** Como `enTransaccion`, pero actuando como `rol` (el rol con el que entra la Data API de Supabase). */
  const como = <T>(rol: (typeof ROLES)[number], fn: (tx: TransactionSql) => Promise<T>) =>
    enTransaccion(async (tx) => {
      await tx.unsafe(`set local role ${rol}`);
      return fn(tx);
    });

  const errorDe = (promesa: Promise<unknown>) =>
    promesa.then(
      () => undefined,
      (e: unknown) => e,
    );

  beforeEach(async () => {
    await limpiar(bd.sql);
    const [sector] = await bd.db
      .insert(sectores)
      .values({
        nombre: 'Sector de prueba',
        geom: sqlDrizzle`ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(cuadrado(-68.0, 10.2))}), 4326)`,
      })
      .returning({ id: sectores.id });
    const residenteId = randomUUID();
    await bd.db.insert(residentes).values({
      id: residenteId,
      sectorId: sector.id,
      ubicacion: sqlDrizzle`ST_SetSRID(ST_MakePoint(-67.995, 10.205), 4326)`,
    });
    await bd.db.insert(reportes).values({
      id: randomUUID(),
      residenteId,
      sectorId: sector.id,
      tipoServicio: 'agua',
      inicioEn: new Date(Date.UTC(2026, 9, 7, 12, 0)),
    });
    await bd.db.insert(eventosSector).values({
      sectorId: sector.id,
      tipoServicio: 'agua',
      inicioEn: new Date(Date.UTC(2026, 9, 7, 12, 0)),
      confirmadoEn: new Date(Date.UTC(2026, 9, 7, 12, 5)),
    });
    await bd.db.insert(estadoSector).values({ sectorId: sector.id, tipoServicio: 'agua' });
  });

  it('NF-06: RLS está activada en las cinco tablas', async () => {
    const filas = await bd.sql<{ relname: string; relrowsecurity: boolean }[]>`
      select c.relname, c.relrowsecurity
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname in ('sectores', 'residentes', 'reportes', 'eventos_sector', 'estado_sector')`;
    expect(filas).toHaveLength(5);
    expect(filas.filter((f) => !f.relrowsecurity)).toEqual([]);
  });

  describe.each(ROLES)('rol %s', (rol) => {
    it.each(TABLAS_PRIVADAS)('NF-06: no puede leer %s (sin privilegio)', async (tabla) => {
      const error = await errorDe(como(rol, (tx) => tx.unsafe(`select * from ${tabla}`)));
      expect(codigoPg(error)).toBe(SIN_PERMISO);
    });

    it('NF-06: no puede leer las coordenadas de residentes', async () => {
      const error = await errorDe(como(rol, (tx) => tx.unsafe('select ubicacion from residentes')));
      expect(codigoPg(error)).toBe(SIN_PERMISO);
    });

    it('VIS-03: puede leer estado_sector', async () => {
      const filas = await como(rol, (tx) => tx`select sector_id, estado from estado_sector`);
      expect(filas).toHaveLength(1);
      expect(filas[0].estado).toBe('con_servicio');
    });

    it('NF-06: no puede escribir en estado_sector', async () => {
      const intentos = [
        "update estado_sector set estado = 'sin_servicio'",
        'delete from estado_sector',
        "insert into estado_sector (sector_id, tipo_servicio) select sector_id, 'electricidad' from estado_sector",
      ];
      for (const intento of intentos) {
        const error = await errorDe(como(rol, (tx) => tx.unsafe(intento)));
        expect(codigoPg(error)).toBe(SIN_PERMISO);
      }
    });

    it('NF-06: no puede usar las secuencias', async () => {
      const [{ puede }] = await bd.sql<{ puede: boolean }[]>`
        select has_sequence_privilege(${rol}, 'eventos_sector_id_seq', 'USAGE') as puede`;
      expect(puede).toBe(false);
    });

    it('NF-06: aunque se le diera SELECT, RLS sin política devuelve 0 filas', async () => {
      const filas = await enTransaccion(async (tx) => {
        for (const tabla of TABLAS_PRIVADAS) await tx.unsafe(`grant select on ${tabla} to ${rol}`);
        await tx.unsafe(`set local role ${rol}`);
        return Promise.all(
          TABLAS_PRIVADAS.map(async (tabla) => (await tx.unsafe(`select * from ${tabla}`)).length),
        );
      });
      expect(filas).toEqual([0, 0, 0, 0]);
    });
  });

  it('el rol de la API (dueño de las tablas) sigue leyendo y escribiendo todo', async () => {
    const [{ n }] = await bd.sql<{ n: number }[]>`select count(*)::int as n from reportes`;
    expect(n).toBe(1);
  });

  describe('publicación supabase_realtime', () => {
    /** Las sentencias de la migración 0002 que tocan la publicación (el último bloque). */
    const bloquePublicacion = () => {
      const migracion = readFileSync(join(__dirname, '../drizzle/0002_rls_realtime.sql'), 'utf8');
      const bloques = migracion.split('--> statement-breakpoint');
      const bloque = bloques[bloques.length - 1];
      expect(bloque).toContain('ALTER PUBLICATION supabase_realtime');
      return bloque;
    };

    const tablasPublicadas = (tx: TransactionSql) =>
      tx<{ tablename: string }[]>`
        select tablename from pg_publication_tables
        where pubname = 'supabase_realtime' order by tablename`;

    it('VIS-03: sin la publicación (PostGIS local) la migración no falla', async () => {
      const [{ existe }] = await bd.sql<{ existe: boolean }[]>`
        select exists (select from pg_publication where pubname = 'supabase_realtime') as existe`;
      // Si esta base ya la tuviera, la prueba de abajo la cubre; aquí solo interesa el caso local.
      if (existe) return;
      await enTransaccion((tx) => tx.unsafe(bloquePublicacion()));
    });

    it('VIS-03: agrega solo estado_sector a la publicación y es idempotente', async () => {
      const tablas = await enTransaccion(async (tx) => {
        await tx.unsafe('create publication supabase_realtime');
        await tx.unsafe(bloquePublicacion());
        await tx.unsafe(bloquePublicacion());
        return (await tablasPublicadas(tx)).map((f) => f.tablename);
      });
      expect(tablas).toEqual(['estado_sector']);
    });
  });
});
