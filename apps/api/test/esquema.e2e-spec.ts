import { randomUUID } from 'node:crypto';
import { sql as sqlDrizzle } from 'drizzle-orm';
import { estadoSector, eventosSector, reportes, residentes, sectores } from '../src/db/schema';
import { abrirBd, type BdTest, codigoPg, cuadrado, limpiar } from './bd';

const CHECK = '23514';
const UNICO = '23505';
const FK = '23503';

describe('esquema de la base (T-010)', () => {
  let bd: BdTest;
  let residenteId: string;
  let sectorId: number;

  const hora = (min: number) => new Date(Date.UTC(2026, 9, 7, 12, min));

  beforeAll(() => {
    bd = abrirBd();
  });
  afterAll(() => bd.sql.end());

  beforeEach(async () => {
    await limpiar(bd.sql);
    const [sector] = await bd.db
      .insert(sectores)
      .values({
        nombre: 'Sector de prueba',
        geom: sqlDrizzle`ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(cuadrado(-68.0, 10.2))}), 4326)`,
      })
      .returning({ id: sectores.id });
    sectorId = sector.id;
    residenteId = randomUUID();
    await bd.db.insert(residentes).values({
      id: residenteId,
      sectorId,
      ubicacion: sqlDrizzle`ST_SetSRID(ST_MakePoint(-67.995, 10.205), 4326)`,
    });
  });

  const nuevoReporte = (extra: Partial<typeof reportes.$inferInsert> = {}) => ({
    id: randomUUID(),
    residenteId,
    sectorId,
    tipoServicio: 'electricidad' as const,
    inicioEn: hora(0),
    ...extra,
  });

  it('REP-07: un reporte con fin anterior al inicio no se guarda (check de la BD)', async () => {
    const error = await bd.db
      .insert(reportes)
      .values(nuevoReporte({ finEn: hora(-5) }))
      .then(
        () => undefined,
        (e: unknown) => e,
      );
    expect(codigoPg(error)).toBe(CHECK);
  });

  it('REP-07: fin igual al inicio sí se acepta (duración cero)', async () => {
    await bd.db.insert(reportes).values(nuevoReporte({ finEn: hora(0) }));
    expect(await bd.db.select().from(reportes)).toHaveLength(1);
  });

  it('REP-05: un segundo reporte abierto del mismo servicio falla (único parcial)', async () => {
    await bd.db.insert(reportes).values(nuevoReporte());
    const error = await bd.db
      .insert(reportes)
      .values(nuevoReporte({ inicioEn: hora(10) }))
      .then(
        () => undefined,
        (e: unknown) => e,
      );
    expect(codigoPg(error)).toBe(UNICO);
  });

  it('REP-06: uno de agua y uno de luz abiertos a la vez sí se permiten', async () => {
    await bd.db.insert(reportes).values(nuevoReporte({ tipoServicio: 'agua' }));
    await bd.db.insert(reportes).values(nuevoReporte({ tipoServicio: 'electricidad' }));
    expect(await bd.db.select().from(reportes)).toHaveLength(2);
  });

  it('REP-05: con el reporte cerrado o vencido se puede abrir otro del mismo servicio', async () => {
    await bd.db.insert(reportes).values(nuevoReporte({ finEn: hora(30) }));
    await bd.db.insert(reportes).values(nuevoReporte({ vencido: true }));
    await bd.db.insert(reportes).values(nuevoReporte({ inicioEn: hora(60) }));
    expect(await bd.db.select().from(reportes)).toHaveLength(3);
  });

  it('CON-03: un segundo evento abierto del mismo sector y servicio falla', async () => {
    const evento = {
      sectorId,
      tipoServicio: 'agua' as const,
      inicioEn: hora(0),
      confirmadoEn: hora(5),
    };
    await bd.db.insert(eventosSector).values(evento);
    const error = await bd.db
      .insert(eventosSector)
      .values(evento)
      .then(
        () => undefined,
        (e: unknown) => e,
      );
    expect(codigoPg(error)).toBe(UNICO);
  });

  it('un evento con fin anterior al inicio no se guarda', async () => {
    const error = await bd.db
      .insert(eventosSector)
      .values({
        sectorId,
        tipoServicio: 'agua',
        inicioEn: hora(10),
        finEn: hora(0),
        confirmadoEn: hora(11),
      })
      .then(
        () => undefined,
        (e: unknown) => e,
      );
    expect(codigoPg(error)).toBe(CHECK);
  });

  it('un reporte de un residente inexistente falla (clave foránea)', async () => {
    const error = await bd.db
      .insert(reportes)
      .values(nuevoReporte({ residenteId: randomUUID() }))
      .then(
        () => undefined,
        (e: unknown) => e,
      );
    expect(codigoPg(error)).toBe(FK);
  });

  it('estado_sector: una fila por sector y servicio, con valores por defecto', async () => {
    await bd.db.insert(estadoSector).values({ sectorId, tipoServicio: 'agua' });
    const [fila] = await bd.db.select().from(estadoSector);
    expect(fila).toMatchObject({ estado: 'con_servicio', reportesSinConfirmar: 0, eventoId: null });
    const duplicada = await bd.db
      .insert(estadoSector)
      .values({ sectorId, tipoServicio: 'agua' })
      .then(
        () => undefined,
        (e: unknown) => e,
      );
    expect(codigoPg(duplicada)).toBe(UNICO);
  });

  it('el residente guarda su ubicación como Point con SRID 4326 y el sector, el polígono', async () => {
    const [fila] = await bd.sql`
      select st_srid(r.ubicacion) as srid_punto, st_srid(s.geom) as srid_sector,
             st_covers(s.geom, r.ubicacion) as dentro
      from residentes r join sectores s on s.id = r.sector_id`;
    expect(fila).toMatchObject({ srid_punto: 4326, srid_sector: 4326, dentro: true });
  });
});
