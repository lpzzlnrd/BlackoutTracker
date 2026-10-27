import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { SectoresGeoJsonDto } from '@blackout/shared';
import { AppModule } from '../src/app.module';
import { CLAVES_JWT } from '../src/auth/claves-jwt';
import { configurarApp } from '../src/configurar-app';
import { leerSectores, sembrarSectores } from '../src/db/sembrar-sectores';
import { abrirBd, type BdTest, limpiar } from './bd';
import { DENTRO, ID_SECTOR } from './fixtures/puntos';
import { EmisorJwt } from './jwt';

describe('GET /sectores (T-014)', () => {
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
    const geojson: unknown = JSON.parse(
      readFileSync(join(__dirname, '../../../data/sectores-cuadricula.geojson'), 'utf-8'),
    );
    await sembrarSectores(bd.sql, leerSectores(geojson));
  });

  it('VIS-01: es público y devuelve un FeatureCollection con los 4 sectores, con id y nombre', async () => {
    const res = await pedir().expect(200);
    const cuerpo = res.body as SectoresGeoJsonDto;
    expect(cuerpo.type).toBe('FeatureCollection');
    expect(cuerpo.features.map((f) => f.id)).toEqual([1, 2, 3, 4]);
    expect(cuerpo.features.map((f) => f.properties.nombre)).toEqual([
      'Guaparo Noroeste',
      'Guaparo Noreste',
      'Guaparo Suroeste',
      'Guaparo Sureste',
    ]);
    for (const f of cuerpo.features) {
      expect(f.type).toBe('Feature');
      expect(f.properties.id).toBe(f.id);
      expect(Object.keys(f.properties).sort()).toEqual(['id', 'nombre']);
      expect(f.geometry.type).toBe('MultiPolygon');
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

  it('VIS-01: lleva Cache-Control público de una hora', async () => {
    const res = await pedir().expect(200);
    expect(res.headers['cache-control']).toBe('public, max-age=3600');
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
