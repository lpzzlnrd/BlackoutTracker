import { Controller, Get, Header } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { SectoresGeoJsonDto } from '@blackout/shared';
import { Public } from '../auth/publico.decorator';
import { THROTTLE_LECTURA } from '../comun/limites';
import { SectoresGeoJsonRespuesta } from './dto/sectores.dto';
import { SectoresService } from './sectores.service';

@ApiTags('sectores')
@Public()
@Throttle(THROTTLE_LECTURA)
@ApiResponse({ status: 429, description: 'DEMASIADAS_SOLICITUDES' })
@Controller('sectores')
export class SectoresController {
  constructor(private readonly sectores: SectoresService) {}

  @Get()
  // Los polígonos casi no cambian (solo con un nuevo seed): una hora de caché basta.
  @Header('Cache-Control', 'public, max-age=3600')
  @ApiOperation({ summary: 'Los sectores de Guaparo como GeoJSON (id, nombre y polígono)' })
  @ApiResponse({ status: 200, type: SectoresGeoJsonRespuesta })
  listar(): Promise<SectoresGeoJsonDto> {
    return this.sectores.geojson();
  }
}
