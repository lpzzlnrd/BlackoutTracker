import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';
import { CLAVES_JWT, crearClavesRemotas } from './claves-jwt';

/**
 * Las claves del JWKS de Supabase. `JwtGuard` se registra como guard global en `AppModule`, junto
 * al throttle, para fijar el orden entre los dos (D-044).
 */
@Module({
  providers: [
    {
      provide: CLAVES_JWT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        crearClavesRemotas(config.get('SUPABASE_URL', { infer: true })),
    },
  ],
  exports: [CLAVES_JWT],
})
export class AuthModule {}
