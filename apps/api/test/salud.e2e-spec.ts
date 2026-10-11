import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { CodigoError } from '@blackout/shared';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/configurar-app';

describe('esqueleto de la API (T-003)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = modulo.createNestApplication();
    configurarApp(app);
    await app.init();
  });

  afterAll(() => app.close());

  it('GET /api/salud responde ok y trae las cabeceras de Helmet', async () => {
    const res = await request(app.getHttpServer()).get('/api/salud').expect(200);
    expect(res.body).toMatchObject({ estado: 'ok' });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('/api/docs abre Swagger', async () => {
    await request(app.getHttpServer()).get('/api/docs').expect(200);
  });

  it('una ruta inexistente devuelve el formato de error con `codigo`', async () => {
    const res = await request(app.getHttpServer()).get('/api/nada').expect(404);
    expect(res.body).toMatchObject({ statusCode: 404 });
    expect(Object.values(CodigoError)).toContain(res.body.codigo);
  });
});
