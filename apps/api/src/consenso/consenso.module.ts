import { Module } from '@nestjs/common';
import { RELOJ } from '../comun/reloj';
import { ConsensoCron } from './consenso.cron';
import { ConsensoService } from './consenso.service';

// El reloj vive aquí porque `ReportesModule` importa este módulo: un solo proveedor para los dos.
@Module({
  providers: [ConsensoService, ConsensoCron, { provide: RELOJ, useValue: () => new Date() }],
  exports: [ConsensoService, ConsensoCron, RELOJ],
})
export class ConsensoModule {}
