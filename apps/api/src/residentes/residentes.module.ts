import { Module } from '@nestjs/common';
import { RegistroGuard } from './registro.guard';
import { ResidentesController } from './residentes.controller';
import { ResidentesService } from './residentes.service';

@Module({
  controllers: [ResidentesController],
  providers: [ResidentesService, RegistroGuard],
  exports: [ResidentesService, RegistroGuard],
})
export class ResidentesModule {}
