import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { SectoresGeoJsonDto, ZonaDto } from '@blackout/shared';
import { AppModule } from '../src/app.module';
import { CLAVES_JWT } from '../src/auth/claves-jwt';
import { configurarApp } from '../src/configurar-app';
import { abrirBd, type BdTest, crearSectoresDePrueba, limpiar } from './bd';
import { CELDA, DENTRO, FUERA, ID_SECTOR, NOMBRE_SECTOR } from './fixtures/puntos';
import { EmisorJwt } from './jwt';

describe('GET /sectores y GET /zona (T-014, T-070)', () => {
  let app: INestApplication;
  let bd: BdTest;
  let emisor: EmisorJwt;

  const pedir = () => request(app.getHttpServer()).get('/api/sectores');

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

  it('VIS-01: es público y devuelve un FeatureCollection con los 4 sectores: id, nombre y municipio', async () => {
    const res = await pedir().expect(200);
    const cuerpo = res.body as SectoresGeoJsonDto;
    expect(cuerpo.type).toBe('FeatureCollection');
    expect(cuerpo.features.map((f) => f.id)).toEqual([1, 2, 3, 4]);
    expect(cuerpo.features.map((f) => f.properties.nombre)).toEqual(Object.values(NOMBRE_SECTOR));
    for (const f of cuerpo.features) {
      expect(f.type).toBe('Feature');
      expect(f.properties.id).toBe(f.id);
      expect(f.properties.municipio).toBe('Valencia');
      expect(Object.keys(f.properties).sort()).toEqual(['id', 'municipio', 'nombre']);
      expect(f.geometry.type).toBe('MultiPolygon');
      expect(f.geometry.coordinates[0]?.[0]).toHaveLength(7); // hexágono cerrado
    }
  });

  it('VIS-01: las coordenadas van como [lng, lat] y cada sector contiene su punto de control', async () => {
    const res = await pedir().expect(200);
    const cuerpo = res.body as SectoresGeoJsonDto;
    const caja = (id: number) => {
      const vertices = cuerpo.features.find((f) => f.id === id)!.geometry.coordinates.flat(2);
      const lngs = vertices.map((v) => v[0]);
      const lats = vertices.map((v) => v[1]);
      return {
        minLng: Math.min(...lngs),
        maxLng: Math.max(...lngs),
        minLat: Math.min(...lats),
        maxLat: Math.max(...lats),
      };
    };
    const cajaDe = [
      [ID_SECTOR.noroeste, DENTRO.noroeste],
      [ID_SECTOR.noreste, DENTRO.noreste],
      [ID_SECTOR.suroeste, DENTRO.suroeste],
      [ID_SECTOR.sureste, DENTRO.sureste],
    ] as const;
    for (const [id, p] of cajaDe) {
      const c = caja(id);
      expect(p.lng).toBeGreaterThan(c.minLng);
      expect(p.lng).toBeLessThan(c.maxLng);
      expect(p.lat).toBeGreaterThan(c.minLat);
      expect(p.lat).toBeLessThan(c.maxLat);
    }
  });

  it('VIS-01: el navegador revalida siempre (un sector nuevo aparece al registrarse su vecino)', async () => {
    const res = await pedir().expect(200);
    expect(res.headers['cache-control']).toBe('public, no-cache');
    expect(res.headers.etag).toBeDefined();
    await pedir()
      .set('If-None-Match', res.headers.etag as string)
      .expect(304);
  });

  it('D-040: un sector nuevo aparece en cuanto se registra su primer vecino', async () => {
    const token = await emisor.firmar({ sub: randomUUID() });
    await request(app.getHttpServer())
      .post('/api/residentes/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ lat: 10.21577, lng: -68.01923 }) // La Viña
      .expect(201);
    const cuerpo = (await pedir().expect(200)).body as SectoresGeoJsonDto;
    expect(cuerpo.features.map((f) => f.properties.nombre)).toEqual([
      ...Object.values(NOMBRE_SECTOR),
      'La Viña',
    ]);
  });

  it('D-040: GET /zona es público y devuelve el contorno de la Gran Valencia, simplificado', async () => {
    const res = await request(app.getHttpServer()).get('/api/zona').expect(200);
    expect(res.headers['cache-control']).toBe('public, max-age=86400');
    const zona = res.body as ZonaDto;
    expect(zona.type).toBe('Feature');
    expect(zona.properties.municipios).toEqual([
      'Valencia',
      'Naguanagua',
      'San Diego',
      'Los Guayos',
      'Libertador',
    ]);
    expect(zona.geometry.type).toBe('MultiPolygon');
    // Una sola pieza, sin huecos, y mucho más liviana que los ~17 500 vértices de OSM.
    expect(zona.geometry.coordinates).toHaveLength(1);
    expect(zona.geometry.coordinates[0]).toHaveLength(1);
    const vertices = zona.geometry.coordinates.flat(2).length;
    expect(vertices).toBeGreaterThan(100);
    expect(vertices).toBeLessThan(2000);
    // Contiene los sectores de prueba y no llega a Guacara.
    const [lngs, lats] = [0, 1].map((i) => zona.geometry.coordinates.flat(2).map((v) => v[i] ?? 0));
    const dentroDeLaCaja = ({ lat, lng }: { lat: number; lng: number }) =>
      lng > Math.min(...lngs) &&
      lng < Math.max(...lngs) &&
      lat > Math.min(...lats) &&
      lat < Math.max(...lats);
    expect(dentroDeLaCaja(DENTRO.noroeste)).toBe(true);
    expect(dentroDeLaCaja(FUERA.caracas)).toBe(false);
  });

  it('D-040: cada sector guarda su celda H3', async () => {
    const filas = await bd.sql`select celda_h3 from sectores order by id`;
    expect(filas.map((f) => f.celda_h3)).toEqual(Object.values(CELDA));
  });

  it('NF-06: no expone nada de los residentes, aunque haya registrados', async () => {
    const id = randomUUID();
    const token = await emisor.firmar({ sub: id });
    await request(app.getHttpServer())
      .post('/api/residentes/me')
      .set('Authorization', `Bearer ${token}`)
      .send(DENTRO.noroeste)
      .expect(201);

    const res = await pedir().expect(200);
    const texto = JSON.stringify(res.body);
    expect(texto).not.toContain(id);
    expect(texto).not.toMatch(/ubicacion|residente|lat"|lng"/i);
    expect(texto).not.toContain(String(DENTRO.noroeste.lat));
  });
});
