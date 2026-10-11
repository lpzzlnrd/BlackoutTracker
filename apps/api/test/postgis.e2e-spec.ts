import postgres, { type Sql } from 'postgres';
import { opcionesConexion } from '../src/db/db.module';
import { URL_BD_TEST } from './entorno';

describe('PostGIS y conexión (T-005)', () => {
  let sql: Sql;

  beforeAll(() => {
    sql = postgres(URL_BD_TEST, opcionesConexion(URL_BD_TEST));
  });
  afterAll(() => sql.end());

  it('SELECT postgis_version() responde con el search_path de la conexión', async () => {
    const [fila] = await sql`select postgis_version() as version`;
    expect(String(fila.version)).toMatch(/^3\./);
  });

  it('la conexión fija search_path=public,extensions, igual que en Supabase', async () => {
    const [fila] = await sql`show search_path`;
    expect(fila.search_path).toBe('public,extensions');
  });

  it('el esquema `extensions` existe (lo crea la migración 0000)', async () => {
    const filas = await sql`select 1 from pg_namespace where nspname = 'extensions'`;
    expect(filas).toHaveLength(1);
  });

  it('ST_MakePoint toma (lng, lat): un punto asimétrico no se confunde', async () => {
    // Valencia: lng -68.0, lat 10.2. Si se invierte el orden, el punto queda fuera del rango válido de latitud.
    const [fila] = await sql`
      select st_x(st_setsrid(st_makepoint(-68.0, 10.2), 4326)) as x,
             st_y(st_setsrid(st_makepoint(-68.0, 10.2), 4326)) as y`;
    expect(Number(fila.x)).toBe(-68);
    expect(Number(fila.y)).toBe(10.2);
  });
});
