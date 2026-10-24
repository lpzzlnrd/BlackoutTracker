import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import type { Env } from '../config/env';
import { CLAVES_JWT, crearClavesRemotas } from './claves-jwt';
import { JwtGuard } from './jwt.guard';

@Module({
  providers: [
    {
      provide: CLAVES_JWT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        crearClavesRemotas(config.get('SUPABASE_URL', { infer: true })),
    },
    { provide: APP_GUARD, useClass: JwtGuard },
  ],
  exports: [CLAVES_JWT],
})
export class AuthModule {}
