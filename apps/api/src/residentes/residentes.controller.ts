import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { PinValidadoDto, SectorAsignadoDto } from '@blackout/shared';
import { Public } from '../auth/publico.decorator';
import { THROTTLE_LECTURA, THROTTLE_REGISTRO } from '../comun/limites';
import { ResidenteActual } from '../auth/residente-actual.decorator';
import { PinDto, PinValidadoRespuesta, SectorAsignadoRespuesta } from './dto/pin.dto';
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
  @ApiOperation({
    summary:
      'Valida que el pin esté en la Gran Valencia y dice en qué sector (hexágono) quedaría, sin crearlo',
  })
  @ApiResponse({ status: 200, type: PinValidadoRespuesta })
  @ApiResponse({ status: 422, description: 'PIN_FUERA_DE_ZONA' })
  validarPin(@Body() pin: PinDto): Promise<PinValidadoDto> {
    return this.residentes.validarPin(pin.lat, pin.lng);
  }

  @ApiBearerAuth()
  @Throttle(THROTTLE_REGISTRO)
  @Post('residentes/me')
  @ApiOperation({
    summary:
      'Crea el perfil del residente con su pin (una sola vez) y, si es el primero, su sector',
  })
  @ApiResponse({ status: 201, type: SectorAsignadoRespuesta })
  @ApiResponse({ status: 409, description: 'RESIDENTE_YA_REGISTRADO' })
  @ApiResponse({ status: 422, description: 'PIN_FUERA_DE_ZONA' })
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
  @ApiOperation({
    summary: 'Sector del residente. Nunca devuelve coordenadas (NF-06)',
    description:
      'La app lo pide al abrir: también anota la hora de entrada, que decide los recordatorios (T-072).',
  })
  @ApiResponse({ status: 200, type: SectorAsignadoRespuesta })
  @ApiResponse({ status: 403, description: 'REGISTRO_INCOMPLETO' })
  async yo(@PerfilActual() perfil: PerfilResidente): Promise<SectorAsignadoDto> {
    await this.residentes.registrarIngreso(perfil.id);
    return {
      sectorId: perfil.sectorId,
      sectorNombre: perfil.sectorNombre,
      municipio: perfil.municipio,
    };
  }
}
