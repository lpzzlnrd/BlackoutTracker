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
import { RELOJ } from '../src/reportes/reportes.service';
import { abrirBd, type BdTest, limpiar } from './bd';
import { EmisorJwt } from './jwt';

export interface ResidentePrueba {
  id: string;
  token: string;
  sectorId: number;
}

/**
 * Arma la API completa contra `blackout_test`, con un JWKS local y un reloj fijo (`ahora`), y deja
 * helpers para registrar residentes y llamar a los endpoints de reportes. Lo comparten los e2e de
 * reportes y de consenso.
 */
export class Contexto {
  private n = 0;

  private constructor(
    readonly app: INestApplication,
    readonly bd: BdTest,
    readonly emisor: EmisorJwt,
    private readonly reloj: { ahora: Date },
  ) {}

  /** La hora que ve la API (el reloj inyectado). */
  get ahora(): Date {
    return this.reloj.ahora;
  }

  set ahora(valor: Date) {
    this.reloj.ahora = valor;
  }

  static async crear(): Promise<Contexto> {
    const bd = abrirBd();
    const emisor = await EmisorJwt.crear();
    const reloj = { ahora: new Date() };
    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CLAVES_JWT)
      .useValue(emisor.claves)
      .overrideProvider(RELOJ)
      .useValue(() => reloj.ahora)
      .compile();
    const app = modulo.createNestApplication();
    configurarApp(app);
    await app.init();
    return new Contexto(app, bd, emisor, reloj);
  }

  async cerrar(): Promise<void> {
    await this.app.close();
    await this.bd.sql.end();
  }

  /**
   * Vacía la base, siembra los sectores y fija `ahora` al reloj real. Por defecto, la cuadrícula de
   * pruebas (la de los puntos de `fixtures/puntos.ts`); la demo usa el Guaparo real.
   */
  async reiniciar(archivo = 'sectores-cuadricula.geojson'): Promise<void> {
    await limpiar(this.bd.sql);
    const geojson: unknown = JSON.parse(
      readFileSync(join(__dirname, '../../../data', archivo), 'utf-8'),
    );
    await sembrarSectores(this.bd.sql, leerSectores(geojson));
    this.ahora = new Date();
  }

  /** `ahora` desplazado `min` minutos (negativo = en el pasado). */
  hace(min: number): string {
    return new Date(this.ahora.getTime() + min * 60_000).toISOString();
  }

  /** Crea un residente directo en la base (sin pasar por el registro) y su token. */
  async residente(sectorId = 1): Promise<ResidentePrueba> {
    const id = randomUUID();
    await this.bd.sql`
      insert into residentes (id, sector_id, ubicacion)
      values (${id}, ${sectorId}, st_setsrid(st_makepoint(-68.009, 10.2075), 4326))`;
    return { id, sectorId, token: await this.emisor.firmar({ sub: id }) };
  }

  private ip(): string {
    this.n += 1;
    return `10.1.${Math.floor(this.n / 250)}.${this.n % 250}`;
  }

  private con(r: request.Test, token?: string): request.Test {
    const t = r.set('X-Forwarded-For', this.ip());
    return token ? t.set('Authorization', `Bearer ${token}`) : t;
  }

  put(id: string, token: string | undefined, cuerpo: unknown): request.Test {
    return this.con(
      request(this.app.getHttpServer())
        .put(`/api/reportes/${id}`)
        .send(cuerpo as object),
      token,
    );
  }

  patch(id: string, token: string | undefined, cuerpo: unknown): request.Test {
    return this.con(
      request(this.app.getHttpServer())
        .patch(`/api/reportes/${id}/cierre`)
        .send(cuerpo as object),
      token,
    );
  }

  get(ruta: string, token?: string): request.Test {
    return this.con(request(this.app.getHttpServer()).get(ruta), token);
  }
}
