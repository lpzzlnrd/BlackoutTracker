import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { SectorAsignadoDto } from '@blackout/shared';
import { Public } from '../auth/publico.decorator';
import { THROTTLE_LECTURA, THROTTLE_REGISTRO } from '../comun/limites';
import { ResidenteActual } from '../auth/residente-actual.decorator';
import { PinDto, SectorAsignadoRespuesta } from './dto/pin.dto';
import { PerfilActual, RegistroGuard } from './registro.guard';
import { type PerfilResidente, ResidentesService } from './residentes.service';

@ApiTags('registro')
@Controller()
export class ResidentesController {
  constructor(private readonly residentes: ResidentesService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('registro/validar-pin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Valida que el pin esté dentro de Guaparo y dice en qué sector cae' })
  @ApiResponse({ status: 200, type: SectorAsignadoRespuesta })
  @ApiResponse({ status: 422, description: 'PIN_FUERA_DE_GUAPARO' })
  validarPin(@Body() pin: PinDto): Promise<SectorAsignadoDto> {
    return this.residentes.sectorDelPin(pin.lat, pin.lng);
  }

  @ApiBearerAuth()
  @Throttle(THROTTLE_REGISTRO)
  @Post('residentes/me')
  @ApiOperation({ summary: 'Crea el perfil del residente con su pin (una sola vez)' })
  @ApiResponse({ status: 201, type: SectorAsignadoRespuesta })
  @ApiResponse({ status: 409, description: 'RESIDENTE_YA_REGISTRADO' })
  @ApiResponse({ status: 422, description: 'PIN_FUERA_DE_GUAPARO' })
  registrar(
    @ResidenteActual() residenteId: string,
    @Body() pin: PinDto,
  ): Promise<SectorAsignadoDto> {
    return this.residentes.registrar(residenteId, pin.lat, pin.lng);
  }

  @ApiBearerAuth()
  @UseGuards(RegistroGuard)
  @Throttle(THROTTLE_LECTURA)
  @Get('residentes/me')
  @ApiOperation({ summary: 'Sector del residente. Nunca devuelve coordenadas (NF-06)' })
  @ApiResponse({ status: 200, type: SectorAsignadoRespuesta })
  @ApiResponse({ status: 403, description: 'REGISTRO_INCOMPLETO' })
  yo(@PerfilActual() perfil: PerfilResidente): SectorAsignadoDto {
    return { sectorId: perfil.sectorId, sectorNombre: perfil.sectorNombre };
  }
}
