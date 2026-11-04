import { Module } from '@nestjs/common';
import { RELOJ } from '../comun/reloj';
import { EstimacionModule } from '../estimacion/estimacion.module';
import { ResidentesModule } from '../residentes/residentes.module';
import { BandejaService } from './bandeja.service';
import { EnvioService } from './envio.service';
import { ImagenSectorService } from './imagen-sector.service';
import { NotificacionesController } from './notificaciones.controller';
import { NotificacionesCron } from './notificaciones.cron';
import { NotificacionesService } from './notificaciones.service';
import { RecordatoriosService } from './recordatorios.service';
import { TRANSPORTE_PUSH, WebPushTransporte } from './transporte-push';

// `ConsensoModule` importa este módulo para escribir en la bandeja, así que el reloj se declara
// aquí también (no se puede importar `ConsensoModule` sin un ciclo). Los tests lo reemplazan en
// todos los módulos a la vez con `overrideProvider(RELOJ)`.
@Module({
  imports: [EstimacionModule, ResidentesModule],
  controllers: [NotificacionesController],
  providers: [
    BandejaService,
    EnvioService,
    ImagenSectorService,
    NotificacionesCron,
    NotificacionesService,
    RecordatoriosService,
    { provide: TRANSPORTE_PUSH, useClass: WebPushTransporte },
    { provide: RELOJ, useValue: () => new Date() },
  ],
  exports: [BandejaService, EnvioService, NotificacionesCron, RecordatoriosService],
})
export class NotificacionesModule {}
