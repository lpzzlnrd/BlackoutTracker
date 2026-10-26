import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/configurar-app';

// No tocan la base: el body y el CORS se resuelven antes de llegar a un controlador.
// El origen permitido es el de `CORS_ORIGINS` por defecto (http://localhost:5173).

const ORIGEN = 'http://localhost:5173';

describe('seguridad HTTP (T-051)', () => {
  let app: INestApplication;
  let n = 0;
  // Una IP distinta por petición para no mezclar el throttle de validar-pin (TRUST_PROXY=1).
  const ip = () => `10.1.0.${++n}`;

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = modulo.createNestApplication();
    configurarApp(app);
    await app.init();
  });

  afterAll(() => app.close());

  it('un body de más de 16 kB es un 413 con el formato de error', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/registro/validar-pin')
      .set('X-Forwarded-For', ip())
      .send({ lat: 10.2, lng: -68, relleno: 'x'.repeat(20_000) })
      .expect(413);
    expect(res.body).toMatchObject({ statusCode: 413, codigo: 'DATOS_INVALIDOS' });
  });

  it('un JSON mal formado es un 400, no un 500', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/registro/validar-pin')
      .set('X-Forwarded-For', ip())
      .set('Content-Type', 'application/json')
      .send('{"lat": ')
      .expect(400);
    expect(res.body).toMatchObject({ statusCode: 400, codigo: 'DATOS_INVALIDOS' });
  });

  it('CORS: el origen de la lista pasa con sus métodos y cabeceras', async () => {
    const res = await request(app.getHttpServer())
      .options('/api/reportes/mios')
      .set('Origin', ORIGEN)
      .set('Access-Control-Request-Method', 'PUT')
      .set('Access-Control-Request-Headers', 'authorization,content-type')
      .expect(204);
    expect(res.headers['access-control-allow-origin']).toBe(ORIGEN);
    expect(res.headers['access-control-allow-methods']).toBe('GET,POST,PUT,PATCH');
    expect(res.headers['access-control-allow-headers']).toBe('Authorization,Content-Type');
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('CORS: un origen que no está en la lista no recibe `Access-Control-Allow-Origin`', async () => {
    const res = await request(app.getHttpServer())
      .options('/api/reportes/mios')
      .set('Origin', 'https://intruso.example')
      .set('Access-Control-Request-Method', 'PUT');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
