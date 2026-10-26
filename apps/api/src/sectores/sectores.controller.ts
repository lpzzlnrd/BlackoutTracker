import { Controller, Get, Header } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { SectoresGeoJsonDto } from '@blackout/shared';
import { Public } from '../auth/publico.decorator';
import { SectoresGeoJsonRespuesta } from './dto/sectores.dto';
import { SectoresService } from './sectores.service';

@ApiTags('sectores')
@Public()
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
