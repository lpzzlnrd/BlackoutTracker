import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { ResumenSectorDto } from '@blackout/shared';
import { Public } from '../auth/publico.decorator';
import { THROTTLE_LECTURA } from '../comun/limites';
import { SectorParamDto } from '../historial/dto/historial.dto';
import { ResumenSectorRespuesta } from './dto/resumen.dto';
import { ResumenService } from './resumen.service';

// Público (D-029): solo agregados por sector, nunca datos de residentes (NF-06).
@ApiTags('sectores')
@Public()
@Throttle(THROTTLE_LECTURA)
@ApiResponse({ status: 429, description: 'DEMASIADAS_SOLICITUDES' })
@Controller('sectores')
export class ResumenController {
  constructor(private readonly resumen: ResumenService) {}

  @Get(':id/resumen')
  @ApiOperation({
    summary: 'Resumen de un sector: estado, estimación y últimos cortes de cada servicio',
    description:
      'Un elemento por servicio (agua y luz nunca se mezclan). La estimación siempre lleva su n y, ' +
      'con menos de n_min cortes, no lleva cifra (EST-04). Recalcula el estado si una ventana de ' +
      'consenso venció desde la última escritura (CON-07).',
  })
  @ApiResponse({ status: 200, type: ResumenSectorRespuesta })
  @ApiResponse({ status: 400, description: 'DATOS_INVALIDOS (id)' })
  @ApiResponse({ status: 404, description: 'SECTOR_NO_ENCONTRADO' })
  obtener(@Param() params: SectorParamDto): Promise<ResumenSectorDto> {
    return this.resumen.resumir(params.id);
  }
}
