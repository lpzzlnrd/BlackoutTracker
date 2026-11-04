import { Module } from '@nestjs/common';
import { RELOJ } from '../comun/reloj';
import { RegistroGuard } from './registro.guard';
import { ResidentesController } from './residentes.controller';
import { ResidentesService } from './residentes.service';

// El reloj, como en `ConsensoModule`: lo usa `ultimo_ingreso` (T-072) y los tests lo fijan.
@Module({
  controllers: [ResidentesController],
  providers: [ResidentesService, RegistroGuard, { provide: RELOJ, useValue: () => new Date() }],
  exports: [ResidentesService, RegistroGuard],
})
export class ResidentesModule {}
