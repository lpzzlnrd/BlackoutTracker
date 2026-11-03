import { Controller, Get, Header } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { SectoresGeoJsonDto, ZonaDto } from '@blackout/shared';
import { Public } from '../auth/publico.decorator';
import { THROTTLE_LECTURA } from '../comun/limites';
import { SectoresGeoJsonRespuesta, ZonaRespuesta } from './dto/sectores.dto';
import { SectoresService } from './sectores.service';

@ApiTags('sectores')
@Public()
@Throttle(THROTTLE_LECTURA)
@ApiResponse({ status: 429, description: 'DEMASIADAS_SOLICITUDES' })
@Controller()
export class SectoresController {
  constructor(private readonly sectores: SectoresService) {}

  @Get('sectores')
  // Un sector nuevo aparece en cuanto se registra su primer vecino, y quien se acaba de registrar
  // tiene que ver el suyo: el navegador revalida siempre (Express responde 304 con el ETag).
  @Header('Cache-Control', 'public, no-cache')
  @ApiOperation({
    summary:
      'Los sectores (hexágonos H3 con vecinos) como GeoJSON: id, nombre, municipio y polígono',
  })
  @ApiResponse({ status: 200, type: SectoresGeoJsonRespuesta })
  listar(): Promise<SectoresGeoJsonDto> {
    return this.sectores.geojson();
  }

  @Get('zona')
  // La zona solo cambia con un nuevo seed: un día de caché.
  @Header('Cache-Control', 'public, max-age=86400')
  @ApiOperation({
    summary: 'El contorno de la zona de cobertura (la Gran Valencia), simplificado para el mapa',
  })
  @ApiResponse({ status: 200, type: ZonaRespuesta })
  zona(): Promise<ZonaDto> {
    return this.sectores.contorno();
  }
}
