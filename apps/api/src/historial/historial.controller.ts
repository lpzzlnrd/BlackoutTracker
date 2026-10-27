import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { HistorialDto } from '@blackout/shared';
import { Public } from '../auth/publico.decorator';
import { THROTTLE_LECTURA } from '../comun/limites';
import { HistorialQueryDto, HistorialRespuesta, SectorParamDto } from './dto/historial.dto';
import { HistorialService } from './historial.service';

// Público (D-029): solo agregados por sector, nunca datos de residentes (NF-06).
@ApiTags('sectores')
@Public()
@Throttle(THROTTLE_LECTURA)
@ApiResponse({ status: 429, description: 'DEMASIADAS_SOLICITUDES' })
@Controller('sectores')
export class HistorialController {
  constructor(private readonly historial: HistorialService) {}

  @Get(':id/historial')
  @ApiOperation({
    summary: 'Historial de cortes cerrados de un sector',
    description:
      'Solo eventos cerrados, el de fin más reciente primero, con su duración. Paginado por cursor: ' +
      'pasa `siguienteCursor` como `cursor` para la página siguiente (nulo en la última).',
  })
  @ApiResponse({ status: 200, type: HistorialRespuesta })
  @ApiResponse({ status: 400, description: 'DATOS_INVALIDOS (parámetros o cursor)' })
  @ApiResponse({ status: 404, description: 'SECTOR_NO_ENCONTRADO' })
  listar(
    @Param() params: SectorParamDto,
    @Query() query: HistorialQueryDto,
  ): Promise<HistorialDto> {
    return this.historial.listar(params.id, query);
  }
}
