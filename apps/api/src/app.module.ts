import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { ignorarArchivoEnv, RUTAS_ENV } from './config/cargar-env';
import { validarEnv } from './config/env';
import { DbModule } from './db/db.module';
import { EstimacionModule } from './estimacion/estimacion.module';
import { HistorialModule } from './historial/historial.module';
import { ReportesModule } from './reportes/reportes.module';
import { ResidentesModule } from './residentes/residentes.module';
import { ResumenModule } from './resumen/resumen.module';
import { SaludController } from './salud/salud.controller';
import { SectoresModule } from './sectores/sectores.module';

@Module({
  imports: [
    // Un solo `.env` en la raíz del monorepo (D-030); en los tests no se lee ninguno.
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validarEnv,
      envFilePath: RUTAS_ENV,
      ignoreEnvFile: ignorarArchivoEnv(),
    }),
    // Límite general: 100 solicitudes por minuto y por IP. Las rutas sensibles lo ajustan (T-015, T-051).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    ScheduleModule.forRoot(),
    DbModule,
    AuthModule,
    ResidentesModule,
    ReportesModule,
    HistorialModule,
    EstimacionModule,
    SectoresModule,
    ResumenModule,
  ],
  controllers: [SaludController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
