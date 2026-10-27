import { Controller, Get, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SignJWT } from 'jose';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { CLAVES_JWT } from '../src/auth/claves-jwt';
import { Public } from '../src/auth/publico.decorator';
import { ResidenteActual } from '../src/auth/residente-actual.decorator';
import { configurarApp } from '../src/configurar-app';
import { EmisorJwt, ISSUER_TEST } from './jwt';

const SUB = '3f0c9a52-1b7e-4a52-9b0e-6a0c2f5d8e11';

// Rutas que solo existen en este test: una protegida y una pública.
@Controller('prueba-auth')
class PruebaAuthController {
  @Get('yo')
  yo(@ResidenteActual() residenteId: string) {
    return { residenteId };
  }

  @Public()
  @Get('abierta')
  abierta() {
    return { ok: true };
  }
}

describe('guard JWT (T-013)', () => {
  let app: INestApplication;
  let emisor: EmisorJwt;

  beforeAll(async () => {
    emisor = await EmisorJwt.crear();
    const modulo = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [PruebaAuthController],
    })
      .overrideProvider(CLAVES_JWT)
      .useValue(emisor.claves)
      .compile();
    app = modulo.createNestApplication();
    configurarApp(app);
    await app.init();
  });
  afterAll(() => app.close());

  const yo = (token?: string) => {
    const r = request(app.getHttpServer()).get('/api/prueba-auth/yo');
    return token === undefined ? r : r.set('Authorization', `Bearer ${token}`);
  };

  it('un token válido pasa y deja el sub como residente', async () => {
    const res = await yo(await emisor.firmar({ sub: SUB })).expect(200);
    expect(res.body).toEqual({ residenteId: SUB });
  });

  it('sin token → 401 con el código NO_AUTENTICADO', async () => {
    const res = await yo().expect(401);
    expect(res.body).toMatchObject({ statusCode: 401, codigo: 'NO_AUTENTICADO' });
  });

  it('un token vencido → 401', async () => {
    await yo(await emisor.firmar({ expira: -60 })).expect(401);
  });

  it('un token firmado con otra clave → 401', async () => {
    const otro = await EmisorJwt.crear(); // mismo kid, otra clave: la firma no coincide
    await yo(await otro.firmar()).expect(401);
  });

  it('un token con otro issuer → 401', async () => {
    await yo(await emisor.firmar({ issuer: 'https://otro.supabase.co/auth/v1' })).expect(401);
    expect(ISSUER_TEST).toBe('http://supabase.test/auth/v1');
  });

  it('un token con otra audiencia → 401', async () => {
    await yo(await emisor.firmar({ audience: 'anon' })).expect(401);
  });

  it('un token sin sub, o con un sub que no es UUID → 401', async () => {
    await yo(await emisor.firmar({ sub: null })).expect(401);
    await yo(await emisor.firmar({ sub: 'no-es-uuid' })).expect(401);
  });

  it('un token HS256 (clave simétrica) → 401 aunque el secreto sea conocido', async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256', kid: 'clave-de-prueba' })
      .setIssuer(ISSUER_TEST)
      .setAudience('authenticated')
      .setSubject(SUB)
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode('secreto-de-prueba-de-32-bytes-minimo!!'));
    await yo(token).expect(401);
  });

  it('basura en el encabezado Authorization → 401', async () => {
    await yo('esto.no.es-un-jwt').expect(401);
    await request(app.getHttpServer())
      .get('/api/prueba-auth/yo')
      .set('Authorization', 'Basic abc')
      .expect(401);
  });

  it('una ruta con @Public() responde sin token', async () => {
    await request(app.getHttpServer()).get('/api/prueba-auth/abierta').expect(200);
    await request(app.getHttpServer()).get('/api/salud').expect(200);
  });
});
