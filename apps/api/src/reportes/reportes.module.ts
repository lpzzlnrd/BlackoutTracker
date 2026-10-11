import { Module } from '@nestjs/common';
import { ConsensoModule } from '../consenso/consenso.module';
import { ResidentesModule } from '../residentes/residentes.module';
import { ReportesController } from './reportes.controller';
import { RELOJ, ReportesService } from './reportes.service';

@Module({
  imports: [ResidentesModule, ConsensoModule],
  controllers: [ReportesController],
  providers: [ReportesService, { provide: RELOJ, useValue: () => new Date() }],
  exports: [ReportesService],
})
export class ReportesModule {}
