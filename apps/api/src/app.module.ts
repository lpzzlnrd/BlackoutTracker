import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { JwtGuard } from './auth/jwt.guard';
import { GuardLimites } from './comun/guard-limites';
import { MENSAJE_LIMITE, THROTTLE_GENERAL } from './comun/limites';
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
    // Límite general (`/salud`); cada controlador declara el suyo (T-015, T-051, D-044).
    ThrottlerModule.forRoot({ throttlers: [THROTTLE_GENERAL], errorMessage: MENSAJE_LIMITE }),
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
  // Los guards globales corren en este orden: primero el JWT, que deja `residenteId`, y después el
  // throttle, que cuenta por ese residente (D-044). Un token inválido es un 401 antes de contar.
  providers: [
    { provide: APP_GUARD, useClass: JwtGuard },
    { provide: APP_GUARD, useClass: GuardLimites },
  ],
})
export class AppModule {}
