import { Module } from '@nestjs/common';
import { ConsensoModule } from '../consenso/consenso.module';
import { EstimacionModule } from '../estimacion/estimacion.module';
import { ResumenController } from './resumen.controller';
import { ResumenService } from './resumen.service';

// Módulo propio y no dentro de `historial/` o de la futura `sectores/` (T-014): el resumen compone
// consenso y estimación, y no debe acoplar esos dos módulos entre sí ni a la lectura de polígonos.
@Module({
  imports: [ConsensoModule, EstimacionModule],
  controllers: [ResumenController],
  providers: [ResumenService],
})
export class ResumenModule {}
