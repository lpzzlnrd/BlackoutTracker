import { Module } from '@nestjs/common';
import { ConsensoModule } from '../consenso/consenso.module';
import { ResidentesModule } from '../residentes/residentes.module';
import { ReportesController } from './reportes.controller';
import { ReportesService } from './reportes.service';

@Module({
  imports: [ResidentesModule, ConsensoModule],
  controllers: [ReportesController],
  providers: [ReportesService],
  exports: [ReportesService],
})
export class ReportesModule {}
