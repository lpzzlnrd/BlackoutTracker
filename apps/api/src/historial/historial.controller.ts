import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { HistorialDto } from '@blackout/shared';
import { HistorialQueryDto, HistorialRespuesta, SectorParamDto } from './dto/historial.dto';
import { HistorialService } from './historial.service';

// Solo JWT (guard global): no pide perfil de residente, porque no devuelve nada de residentes.
@ApiTags('sectores')
@ApiBearerAuth()
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
