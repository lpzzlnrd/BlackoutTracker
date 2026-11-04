import { Module } from '@nestjs/common';
import { RELOJ } from '../comun/reloj';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { ConsensoCron } from './consenso.cron';
import { ConsensoService } from './consenso.service';

// El reloj vive aquí porque `ReportesModule` importa este módulo: un solo proveedor para los dos.
// `NotificacionesModule` da la bandeja de salida, que se escribe dentro de la transacción (T-072).
@Module({
  imports: [NotificacionesModule],
  providers: [ConsensoService, ConsensoCron, { provide: RELOJ, useValue: () => new Date() }],
  exports: [ConsensoService, ConsensoCron, RELOJ],
})
export class ConsensoModule {}
