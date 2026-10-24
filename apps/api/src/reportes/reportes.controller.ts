import { Body, Controller, Param, ParseUUIDPipe, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { ReporteDto } from '@blackout/shared';
import { PerfilActual, RegistroGuard } from '../residentes/registro.guard';
import type { PerfilResidente } from '../residentes/residentes.service';
import { IniciarReporteDto, ReporteRespuesta } from './dto/iniciar-reporte.dto';
import { ReportesService } from './reportes.service';

@ApiTags('reportes')
@ApiBearerAuth()
@UseGuards(RegistroGuard)
@Controller('reportes')
export class ReportesController {
  constructor(private readonly reportes: ReportesService) {}

  @Put(':id')
  @ApiOperation({
    summary: 'Inicio de un corte (idempotente)',
    description:
      'El `id` es un UUID generado por el cliente. Reintentar el mismo PUT devuelve el mismo reporte (200). ' +
      'Se guarda la hora de `ocurridoEn`, no la del envío.',
  })
  @ApiResponse({ status: 200, type: ReporteRespuesta })
  @ApiResponse({ status: 403, description: 'REGISTRO_INCOMPLETO' })
  @ApiResponse({
    status: 409,
    description:
      'REPORTE_ABIERTO_DUPLICADO (REP-05) o REPORTE_CONFLICTO (mismo id, otro contenido)',
  })
  @ApiResponse({ status: 422, description: 'HORA_INVALIDA (futuro o demasiado antigua)' })
  iniciar(
    @PerfilActual() perfil: PerfilResidente,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() cuerpo: IniciarReporteDto,
  ): Promise<ReporteDto> {
    return this.reportes.iniciar(perfil, id, cuerpo);
  }
}
