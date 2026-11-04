import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { PinValidadoDto, SectorAsignadoDto } from '@blackout/shared';
import { Public } from '../auth/publico.decorator';
import { THROTTLE_LECTURA, THROTTLE_REGISTRO, THROTTLE_VALIDAR_PIN } from '../comun/limites';
import { ResidenteActual } from '../auth/residente-actual.decorator';
import { PinDto, PinValidadoRespuesta, SectorAsignadoRespuesta } from './dto/pin.dto';
import { PerfilActual, RegistroGuard } from './registro.guard';
import { type PerfilResidente, ResidentesService } from './residentes.service';

@ApiTags('registro')
@Controller()
export class ResidentesController {
  constructor(private readonly residentes: ResidentesService) {}

  @Public()
  @Throttle(THROTTLE_VALIDAR_PIN)
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
      'Crea el perfil del residente con su pin (una sola vez) y, si es el primero, su sector (idempotente)',
    description:
      'Repetir el registro con un pin del mismo sector (doble envío o reintento) devuelve el mismo ' +
      'sector (201) sin cambiar nada; la ubicación guardada sigue siendo la primera.',
  })
  @ApiResponse({ status: 201, type: SectorAsignadoRespuesta })
  @ApiResponse({
    status: 409,
    description: 'RESIDENTE_YA_REGISTRADO (ya registrado en otro sector)',
  })
  @ApiResponse({ status: 429, description: 'DEMASIADAS_SOLICITUDES' })
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
  @ApiOperation({ summary: 'Sector del residente. Nunca devuelve coordenadas (NF-06)' })
  @ApiResponse({ status: 200, type: SectorAsignadoRespuesta })
  @ApiResponse({ status: 403, description: 'REGISTRO_INCOMPLETO' })
  yo(@PerfilActual() perfil: PerfilResidente): SectorAsignadoDto {
    return {
      sectorId: perfil.sectorId,
      sectorNombre: perfil.sectorNombre,
      municipio: perfil.municipio,
    };
  }
}
