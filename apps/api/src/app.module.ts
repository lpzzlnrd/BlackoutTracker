import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { validarEnv } from './config/env';
import { DbModule } from './db/db.module';
import { ReportesModule } from './reportes/reportes.module';
import { ResidentesModule } from './residentes/residentes.module';
import { SaludController } from './salud/salud.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validarEnv }),
    // Límite general: 100 solicitudes por minuto y por IP. Las rutas sensibles lo ajustan (T-015, T-051).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    DbModule,
    AuthModule,
    ResidentesModule,
    ReportesModule,
  ],
  controllers: [SaludController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
