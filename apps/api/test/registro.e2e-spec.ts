import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { CLAVES_JWT } from '../src/auth/claves-jwt';
import { configurarApp } from '../src/configurar-app';
import { leerSectores, sembrarSectores } from '../src/db/sembrar-sectores';
import { abrirBd, type BdTest, limpiar } from './bd';
import {
  BORDE_ENTRE_SECTORES,
  BORDE_EXTERIOR,
  DENTRO,
  FUERA,
  ID_SECTOR,
  INTERCAMBIADO,
} from './fixtures/puntos';
import { EmisorJwt } from './jwt';

// Cada petición lleva una IP distinta (X-Forwarded-For; TRUST_PROXY=1 en test/setup-env.ts) para
// que el throttle de validar-pin (10 por minuto y por IP) no cuente entre tests; el test del
// throttle usa una IP fija.

describe('registro (T-015)', () => {
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
    const geojson: unknown = JSON.parse(
      readFileSync(join(__dirname, '../../../data/sectores-cuadricula.geojson'), 'utf-8'),
    );
    await sembrarSectores(bd.sql, leerSectores(geojson));
  });

  it('REG-01: un pin dentro de Guaparo devuelve su sector', async () => {
    const res = await validar(DENTRO.noreste).expect(200);
    expect(res.body).toEqual({ sectorId: ID_SECTOR.noreste, sectorNombre: 'Guaparo Noreste' });
  });

  it('REG-01: registrarse crea el perfil asociado al sector que contiene el pin', async () => {
    const sub = randomUUID();
    const res = await registrar(sub, DENTRO.sureste, 201);
    expect(res.body).toEqual({ sectorId: ID_SECTOR.sureste, sectorNombre: 'Guaparo Sureste' });
    const [fila] =
      await bd.sql`select sector_id, st_x(ubicacion) as x, st_y(ubicacion) as y from residentes where id = ${sub}`;
    expect(fila).toMatchObject({
      sector_id: ID_SECTOR.sureste,
      x: DENTRO.sureste.lng,
      y: DENTRO.sureste.lat,
    });
  });

  it('REG-01: lat y lng no se intercambian (punto asimétrico)', async () => {
    // El pin del Noreste con los valores cruzados cae fuera; el mismo pin bien puesto, dentro.
    await validar(INTERCAMBIADO).expect(422);
    await validar(DENTRO.noreste).expect(200);
  });

  it('REG-02: un pin fuera de Guaparo → 422 PIN_FUERA_DE_GUAPARO y no se crea el perfil', async () => {
    for (const fuera of Object.values(FUERA)) {
      const res = await validar(fuera).expect(422);
      expect(res.body).toMatchObject({ codigo: 'PIN_FUERA_DE_GUAPARO' });
    }
    const sub = randomUUID();
    const res = await registrar(sub, FUERA.cerca, 422);
    expect(res.body.codigo).toBe('PIN_FUERA_DE_GUAPARO');
    const [{ n: total }] = await bd.sql`select count(*)::int as n from residentes`;
    expect(total).toBe(0);
  });

  it('REG-03: el borde exterior se acepta, siempre igual', async () => {
    for (const punto of Object.values(BORDE_EXTERIOR)) {
      for (let i = 0; i < 3; i++) await validar(punto).expect(200);
    }
  });

  it('REG-03: sobre el borde entre sectores gana el de menor id, siempre igual', async () => {
    for (const { punto, sectorId } of Object.values(BORDE_ENTRE_SECTORES)) {
      for (let i = 0; i < 3; i++) {
        const res = await validar(punto).expect(200);
        expect(res.body.sectorId).toBe(sectorId);
      }
    }
  });

  it('registrarse dos veces → 409 RESIDENTE_YA_REGISTRADO y el perfil no cambia', async () => {
    const sub = randomUUID();
    await registrar(sub, DENTRO.noroeste, 201);
    const res = await registrar(sub, DENTRO.sureste, 409);
    expect(res.body.codigo).toBe('RESIDENTE_YA_REGISTRADO');
    expect((await yo(sub)).body.sectorId).toBe(ID_SECTOR.noroeste);
  });

  it('GET /residentes/me devuelve el sector y NUNCA coordenadas (NF-06)', async () => {
    const sub = randomUUID();
    await registrar(sub, DENTRO.noroeste, 201);
    const res = await yo(sub).then((r) => r);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ sectorId: ID_SECTOR.noroeste, sectorNombre: 'Guaparo Noroeste' });
    const texto =
      JSON.stringify(res.body) +
      JSON.stringify((await registrar(randomUUID(), DENTRO.noreste)).body);
    expect(texto).not.toMatch(/ubicacion|lat|lng|10\.2075|68\.00/);
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

  it('validar-pin tiene throttle estricto: la solicitud 11 desde la misma IP → 429', async () => {
    const fija = '203.0.113.7';
    for (let i = 0; i < 10; i++) await validar(DENTRO.noreste, fija).expect(200);
    const res = await validar(DENTRO.noreste, fija).expect(429);
    expect(res.body.codigo).toBe('DEMASIADAS_SOLICITUDES');
  });
});
