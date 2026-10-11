import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';
import type { Env } from '../config/env';
import * as schema from './schema';

export type BaseDeDatos = PostgresJsDatabase<typeof schema>;
/** El `tx` que recibe `db.transaction(...)`. */
export type Transaccion = Parameters<Parameters<BaseDeDatos['transaction']>[0]>[0];

/** Token de inyección de la base (Drizzle). */
export const DB = Symbol('DB');
/** Token del cliente postgres-js subyacente (para cerrarlo y para los tests). */
export const CLIENTE_PG = Symbol('CLIENTE_PG');

/**
 * Opciones de conexión. `search_path=public,extensions` hace que el SQL sea el mismo en Supabase
 * (PostGIS vive en `extensions`) y en el Postgres local (docs/PLAN.md §4). El pooler de Supabase en
 * modo transaction (puerto 6543) no admite sentencias preparadas.
 */
export function opcionesConexion(url: string): postgres.Options<Record<string, never>> {
  return {
    max: 10,
    prepare: !url.includes(':6543'),
    connection: { search_path: 'public,extensions' },
    onnotice: () => undefined,
  };
}

@Global()
@Module({
  providers: [
    {
      provide: CLIENTE_PG,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const url = config.get('DATABASE_URL', { infer: true });
        return postgres(url, opcionesConexion(url));
      },
    },
    {
      provide: DB,
      inject: [CLIENTE_PG],
      useFactory: (cliente: Sql) => drizzle(cliente, { schema }),
    },
  ],
  exports: [DB, CLIENTE_PG],
})
export class DbModule implements OnApplicationShutdown {
  constructor(@Inject(CLIENTE_PG) private readonly cliente: Sql) {}

  async onApplicationShutdown(): Promise<void> {
    await this.cliente.end({ timeout: 5 });
  }
}
