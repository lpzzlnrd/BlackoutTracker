import { Body, Controller, Param, ParseUUIDPipe, Patch, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { ReporteDto } from '@blackout/shared';
import { PerfilActual, RegistroGuard } from '../residentes/registro.guard';
import type { PerfilResidente } from '../residentes/residentes.service';
import { CerrarReporteDto } from './dto/cerrar-reporte.dto';
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

  @Patch(':id/cierre')
  @ApiOperation({
    summary: 'Cierre de un corte: volvió el servicio (idempotente)',
    description:
      'Calcula y devuelve la duración. Un id inexistente o ajeno es 404 (un cierre sin inicio se bloquea); ' +
      'el cliente lo reintenta porque el inicio puede estar en camino.',
  })
  @ApiResponse({ status: 200, type: ReporteRespuesta })
  @ApiResponse({ status: 404, description: 'REPORTE_NO_ENCONTRADO' })
  @ApiResponse({ status: 409, description: 'REPORTE_CONFLICTO (ya cerrado con otra hora)' })
  @ApiResponse({ status: 422, description: 'HORA_INVALIDA (fin anterior al inicio, REP-07)' })
  cerrar(
    @PerfilActual() perfil: PerfilResidente,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() cuerpo: CerrarReporteDto,
  ): Promise<ReporteDto> {
    return this.reportes.cerrar(perfil, id, cuerpo);
  }
}
