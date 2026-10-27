import { Module } from '@nestjs/common';
import { EstimacionController } from './estimacion.controller';
import { EstimacionService } from './estimacion.service';

@Module({
  controllers: [EstimacionController],
  providers: [EstimacionService],
  exports: [EstimacionService],
})
export class EstimacionModule {}
