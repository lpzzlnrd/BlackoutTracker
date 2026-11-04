import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { CLAVES_JWT } from '../src/auth/claves-jwt';
import { configurarApp } from '../src/configurar-app';
import { asegurarSector } from '../src/sectores/ubicacion';
import { abrirBd, type BdTest, crearSectoresDePrueba, limpiar } from './bd';
import {
  BORDE_ZONA,
  CELDA,
  DENTRO,
  FUERA,
  ID_SECTOR,
  INTERCAMBIADO,
  LA_VINA,
  MISMA_CELDA_NOROESTE,
} from './fixtures/puntos';
import { EmisorJwt } from './jwt';

// Cada petición lleva una IP distinta (X-Forwarded-For; TRUST_PROXY=1 en test/setup-env.ts) para
// que el throttle de validar-pin (30 por minuto y por IP) no cuente entre tests; los tests del
// throttle usan una IP fija. El de `POST /residentes/me` cuenta por residente (D-044).

describe('registro (T-015, T-070)', () => {
  let app: INestApplication;
  let bd: BdTest;
  let emisor: EmisorJwt;
  let n = 0;

  const ip = () => `10.0.${Math.floor(++n / 250)}.${n % 250}`;
  const validar = (cuerpo: unknown, direccion = ip()) =>
    request(app.getHttpServer())
      .post('/api/registro/validar-pin')
      .set('X-Forwarded-For', direccion)
      .send(cuerpo as object);
  const conToken = async (r: request.Test, sub: string) =>
    r.set('Authorization', `Bearer ${await emisor.firmar({ sub })}`).set('X-Forwarded-For', ip());
  const registrar = async (sub: string, cuerpo: unknown, estado?: number) => {
    const res = await conToken(
      request(app.getHttpServer())
        .post('/api/residentes/me')
        .send(cuerpo as object),
      sub,
    );
    if (estado !== undefined) expect(res.status).toBe(estado);
    return res;
  };
  const yo = async (sub: string) =>
    conToken(request(app.getHttpServer()).get('/api/residentes/me'), sub);

  beforeAll(async () => {
    bd = abrirBd();
    emisor = await EmisorJwt.crear();
    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CLAVES_JWT)
      .useValue(emisor.claves)
      .compile();
    app = modulo.createNestApplication();
    configurarApp(app);
    await app.init();
  });
  afterAll(async () => {
    await app.close();
    await bd.sql.end();
  });
  beforeEach(async () => {
    await limpiar(bd.sql);
    await crearSectoresDePrueba(bd.db);
  });

  const contar = async (tabla: 'sectores' | 'residentes' | 'estado_sector') => {
    const [{ n }] = await bd.sql<{ n: number }[]>`select count(*)::int as n from ${bd.sql(tabla)}`;
    return n;
  };
  /** Un hexágono GeoJSON: un polígono, un anillo cerrado de 6 vértices. */
  const esHexagono = (g: { type: string; coordinates: number[][][][] }) =>
    g.type === 'MultiPolygon' && g.coordinates.length === 1 && g.coordinates[0]?.[0]?.length === 7;

  it('REG-01: un pin en una celda con vecinos devuelve su sector y su hexágono', async () => {
    const res = await validar(DENTRO.noreste).expect(200);
    expect(res.body).toMatchObject({
      sectorId: ID_SECTOR.noreste,
      sectorNombre: 'Noreste',
      municipio: 'Valencia',
    });
    expect(esHexagono(res.body.geometria)).toBe(true);
  });

  it('REG-01: otro pin de la misma celda cae en el mismo sector', async () => {
    const res = await validar(MISMA_CELDA_NOROESTE).expect(200);
    expect(res.body.sectorId).toBe(ID_SECTOR.noroeste);
  });

  it('D-040: en una celda sin vecinos dice qué sector sería, con el nombre de OSM, sin crearlo', async () => {
    const res = await validar(LA_VINA).expect(200);
    expect(res.body).toMatchObject({
      sectorId: null,
      sectorNombre: 'La Viña',
      municipio: 'Valencia',
    });
    expect(esHexagono(res.body.geometria)).toBe(true);
    expect(await contar('sectores')).toBe(4);
  });

  it('REG-01: registrarse crea el perfil asociado al sector de la celda del pin', async () => {
    const sub = randomUUID();
    const res = await registrar(sub, DENTRO.sureste, 201);
    expect(res.body).toEqual({
      sectorId: ID_SECTOR.sureste,
      sectorNombre: 'Sureste',
      municipio: 'Valencia',
    });
    const [fila] =
      await bd.sql`select sector_id, st_x(ubicacion) as x, st_y(ubicacion) as y from residentes where id = ${sub}`;
    expect(fila).toMatchObject({
      sector_id: ID_SECTOR.sureste,
      x: DENTRO.sureste.lng,
      y: DENTRO.sureste.lat,
    });
    expect(await contar('sectores')).toBe(4);
  });

  it('D-040: el primer vecino de una celda crea el sector (hexágono, celda, municipio y estado)', async () => {
    const res = await registrar(randomUUID(), LA_VINA, 201);
    expect(res.body).toEqual({ sectorId: 5, sectorNombre: 'La Viña', municipio: 'Valencia' });
    const [sector] = await bd.sql`
      select s.celda_h3, m.nombre as municipio, st_npoints(s.geom) as vertices,
             st_isvalid(s.geom) as valido,
             st_covers(s.geom, st_setsrid(st_makepoint(${LA_VINA.lng}, ${LA_VINA.lat}), 4326)) as cubre_pin
      from sectores s join municipios m on m.id = s.municipio_id where s.id = 5`;
    expect(sector).toEqual({
      celda_h3: '8867432a27fffff',
      municipio: 'Valencia',
      vertices: 7,
      valido: true,
      cubre_pin: true,
    });
    const estados = await bd.sql`
      select estado from estado_sector where sector_id = 5 order by tipo_servicio`;
    expect(estados.map((e) => e.estado)).toEqual(['con_servicio', 'con_servicio']);
    // El segundo vecino de la celda entra en el mismo sector, sin crear otro.
    expect((await registrar(randomUUID(), LA_VINA, 201)).body.sectorId).toBe(5);
    expect(await contar('sectores')).toBe(5);
  });

  it('D-040: si el nombre del lugar ya lo tiene otro sector, el nuevo se numera', async () => {
    // Otra celda se queda con "La Viña" antes que la de La Viña.
    await bd.db.transaction((tx) => asegurarSector(tx, 10.24, -68.03, 'La Viña'));
    const previa = await validar(LA_VINA).expect(200);
    expect(previa.body).toMatchObject({ sectorId: null, sectorNombre: 'La Viña 2' });
    const res = await registrar(randomUUID(), LA_VINA, 201);
    expect(res.body.sectorNombre).toBe('La Viña 2');
  });

  it('D-040: con un 409 el sector nuevo no se queda creado sin vecinos', async () => {
    const sub = randomUUID();
    await registrar(sub, DENTRO.noroeste, 201);
    await registrar(sub, LA_VINA, 409);
    expect(await contar('sectores')).toBe(4);
    expect(await contar('estado_sector')).toBe(8);
  });

  it('D-040: cinco registros a la vez en una celda nueva crean un solo sector', async () => {
    const respuestas = await Promise.all(
      Array.from({ length: 5 }, () => registrar(randomUUID(), LA_VINA, 201)),
    );
    expect(new Set(respuestas.map((r) => r.body.sectorId)).size).toBe(1);
    expect(await contar('sectores')).toBe(5);
    expect(await contar('residentes')).toBe(5);
  });

  it('REG-01: lat y lng no se intercambian (punto asimétrico)', async () => {
    // El pin del Noreste con los valores cruzados cae fuera; el mismo pin bien puesto, dentro.
    await validar(INTERCAMBIADO).expect(422);
    await validar(DENTRO.noreste).expect(200);
  });

  it('REG-02: un pin fuera de la Gran Valencia → 422 PIN_FUERA_DE_ZONA, sin perfil ni sector', async () => {
    for (const fuera of Object.values(FUERA)) {
      const res = await validar(fuera).expect(422);
      expect(res.body).toMatchObject({ codigo: 'PIN_FUERA_DE_ZONA' });
    }
    const res = await registrar(randomUUID(), FUERA.cerca, 422);
    expect(res.body.codigo).toBe('PIN_FUERA_DE_ZONA');
    expect(await contar('residentes')).toBe(0);
    expect(await contar('sectores')).toBe(4);
  });

  it('REG-03: un pin sobre el límite exterior de la zona se acepta, siempre igual', async () => {
    const respuestas: unknown[] = [];
    for (let i = 0; i < 3; i++) respuestas.push((await validar(BORDE_ZONA).expect(200)).body);
    expect(respuestas[0]).toMatchObject({ municipio: 'Valencia' });
    expect(respuestas[1]).toEqual(respuestas[0]);
    expect(respuestas[2]).toEqual(respuestas[0]);
  });

  it('REG-03: cada pin va a una sola celda (H3 no tiene empates en los bordes)', async () => {
    const [{ celdas }] =
      await bd.sql`select array_agg(celda_h3 order by id) as celdas from sectores`;
    expect(celdas).toEqual(Object.values(CELDA));
  });

  it('registrarse otra vez en otro sector → 409 RESIDENTE_YA_REGISTRADO y el perfil no cambia', async () => {
    const sub = randomUUID();
    await registrar(sub, DENTRO.noroeste, 201);
    const res = await registrar(sub, DENTRO.sureste, 409);
    expect(res.body.codigo).toBe('RESIDENTE_YA_REGISTRADO');
    expect((await yo(sub)).body.sectorId).toBe(ID_SECTOR.noroeste);
  });

  it('OFF-05: repetir el registro con el mismo pin → 201, la misma respuesta y una sola fila', async () => {
    const sub = randomUUID();
    const primero = await registrar(sub, DENTRO.noroeste, 201);
    const segundo = await registrar(sub, DENTRO.noroeste, 201);
    expect(segundo.body).toEqual(primero.body);
    expect(await contar('residentes')).toBe(1);
  });

  it('OFF-05: otro pin del mismo sector → 201 con su sector y la ubicación guardada no cambia', async () => {
    const sub = randomUUID();
    await registrar(sub, DENTRO.noroeste, 201);
    const res = await registrar(sub, MISMA_CELDA_NOROESTE, 201);
    expect(res.body.sectorId).toBe(ID_SECTOR.noroeste);
    const [fila] =
      await bd.sql`select st_x(ubicacion) as x, st_y(ubicacion) as y from residentes where id = ${sub}`;
    expect(fila).toEqual({ x: DENTRO.noroeste.lng, y: DENTRO.noroeste.lat });
  });

  it('OFF-05: el mismo registro dos veces a la vez en una celda nueva → 201 las dos, 1 residente y 1 sector', async () => {
    const sub = randomUUID();
    const [a, b] = await Promise.all([registrar(sub, LA_VINA), registrar(sub, LA_VINA)]);
    expect([a.status, b.status]).toEqual([201, 201]);
    expect(b.body).toEqual(a.body);
    expect(await contar('residentes')).toBe(1);
    expect(await contar('sectores')).toBe(5);
  });

  it('GET /residentes/me devuelve el sector y NUNCA coordenadas (NF-06)', async () => {
    const sub = randomUUID();
    await registrar(sub, DENTRO.noroeste, 201);
    const res = await yo(sub).then((r) => r);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      sectorId: ID_SECTOR.noroeste,
      sectorNombre: 'Noroeste',
      municipio: 'Valencia',
    });
    const texto =
      JSON.stringify(res.body) +
      JSON.stringify((await registrar(randomUUID(), DENTRO.noreste)).body);
    expect(texto).not.toMatch(/ubicacion|lat|lng|10\.225|68\.01|68\.00/);
  });

  it('un usuario autenticado sin perfil → 403 REGISTRO_INCOMPLETO en GET /residentes/me', async () => {
    const res = await yo(randomUUID());
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ codigo: 'REGISTRO_INCOMPLETO' });
  });

  it('POST /residentes/me sin token → 401, pero validar-pin es público', async () => {
    await request(app.getHttpServer()).post('/api/residentes/me').send(DENTRO.noroeste).expect(401);
    await validar(DENTRO.noroeste).expect(200);
  });

  it('un cuerpo inválido → 400 DATOS_INVALIDOS (tipo, rango, campos de más, vacío)', async () => {
    for (const malo of [
      { lat: '10.2', lng: -68 },
      { lat: 91, lng: -68 },
      { lat: 10.2, lng: -181 },
      { lat: 10.2 },
      { ...DENTRO.noreste, extra: 1 },
      {},
    ]) {
      const res = await validar(malo).expect(400);
      expect(res.body.codigo).toBe('DATOS_INVALIDOS');
    }
  });

  it('validar-pin tiene throttle por IP: la solicitud 31 desde la misma IP → 429 en español', async () => {
    const fija = '203.0.113.7';
    for (let i = 0; i < 30; i++) await validar(DENTRO.noreste, fija).expect(200);
    const res = await validar(DENTRO.noreste, fija).expect(429);
    expect(res.body).toMatchObject({
      statusCode: 429,
      codigo: 'DEMASIADAS_SOLICITUDES',
      message: 'Demasiadas solicitudes. Espera un momento y vuelve a intentarlo.',
    });
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
    // Otra IP no comparte el límite.
    await validar(DENTRO.noreste, '203.0.113.8').expect(200);
  });

  it('D-044: el registro cuenta por residente: el 6.º intento en un minuto → 429, y otro vecino de la misma IP pasa', async () => {
    const fija = '198.51.100.20';
    const enviar = async (sub: string) =>
      request(app.getHttpServer())
        .post('/api/residentes/me')
        .set('Authorization', `Bearer ${await emisor.firmar({ sub })}`)
        .set('X-Forwarded-For', fija)
        .send(DENTRO.noroeste);
    const a = randomUUID();
    for (let i = 0; i < 5; i++) expect((await enviar(a)).status).toBe(201);
    const frenado = await enviar(a);
    expect(frenado.status).toBe(429);
    expect(frenado.body.codigo).toBe('DEMASIADAS_SOLICITUDES');
    // Si el throttle contara por IP (o corriera antes que el JWT), este también sería un 429.
    expect((await enviar(randomUUID())).status).toBe(201);
  });
});
