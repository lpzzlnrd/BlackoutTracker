import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { EstimacionDto } from '@blackout/shared';
import { Public } from '../auth/publico.decorator';
import { THROTTLE_LECTURA } from '../comun/limites';
import { EstimacionQueryDto, EstimacionRespuesta } from './dto/estimacion-query.dto';
import { EstimacionService } from './estimacion.service';

// Público (D-029): solo agregados por sector, nunca datos de residentes (NF-06).
@ApiTags('estimaciones')
@Public()
@Throttle(THROTTLE_LECTURA)
@ApiResponse({ status: 429, description: 'DEMASIADAS_SOLICITUDES' })
@Controller('estimaciones')
export class EstimacionController {
  constructor(private readonly estimacion: EstimacionService) {}

  @Get()
  @ApiOperation({
    summary: 'Estimación estadística de la duración de un corte',
    description:
      'Mediana de la duración de los cortes cerrados del sector y servicio. Con menos de n_min ' +
      'cortes devuelve `suficiente: false` y solo el n (EST-04). La cifra siempre va con su n.',
  })
  @ApiResponse({ status: 200, type: EstimacionRespuesta })
  @ApiResponse({ status: 404, description: 'SECTOR_NO_ENCONTRADO' })
  estimar(@Query() query: EstimacionQueryDto): Promise<EstimacionDto> {
    return this.estimacion.estimar(query.sectorId, query.tipoServicio);
  }
}
