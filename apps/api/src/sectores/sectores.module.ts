import { Module } from '@nestjs/common';
import { SectoresController } from './sectores.controller';
import { SectoresService } from './sectores.service';

@Module({
  controllers: [SectoresController],
  providers: [SectoresService],
  exports: [SectoresService],
})
export class SectoresModule {}
