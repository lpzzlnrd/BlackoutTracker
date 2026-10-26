import { Module } from '@nestjs/common';
import { RELOJ } from '../comun/reloj';
import { ConsensoService } from './consenso.service';

// El reloj vive aquí porque `ReportesModule` importa este módulo: un solo proveedor para los dos.
@Module({
  providers: [ConsensoService, { provide: RELOJ, useValue: () => new Date() }],
  exports: [ConsensoService, RELOJ],
})
export class ConsensoModule {}
