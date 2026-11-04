import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import type { ClavePushDto, PreferenciasNotificacionesDto } from '@blackout/shared';
import { Public } from '../auth/publico.decorator';
import { ResidenteActual } from '../auth/residente-actual.decorator';
import { THROTTLE_ESCRITURA, THROTTLE_LECTURA } from '../comun/limites';
import { RegistroGuard } from '../residentes/registro.guard';
import {
  BajaSuscripcionDto,
  ClavePushRespuesta,
  ImagenParamsDto,
  PreferenciasDto,
  PreferenciasRespuesta,
  SuscripcionPushDto,
} from './dto/notificaciones.dto';
import { ImagenSectorService } from './imagen-sector.service';
import { NotificacionesService } from './notificaciones.service';

@ApiTags('notificaciones')
@ApiResponse({ status: 400, description: 'DATOS_INVALIDOS' })
@ApiResponse({ status: 429, description: 'DEMASIADAS_SOLICITUDES' })
@Controller('notificaciones')
export class NotificacionesController {
  constructor(
    private readonly notificaciones: NotificacionesService,
    private readonly imagenes: ImagenSectorService,
  ) {}

  @Public()
  @Throttle(THROTTLE_LECTURA)
  @Get('clave')
  @ApiOperation({
    summary: 'Clave pública VAPID para suscribirse a Web Push',
    description: 'Con `activo: false` la API no envía notificaciones y la web no las ofrece.',
  })
  @ApiResponse({ status: 200, type: ClavePushRespuesta })
  clave(): ClavePushDto {
    return this.notificaciones.clave();
  }

  @ApiBearerAuth()
  @UseGuards(RegistroGuard)
  @Throttle(THROTTLE_ESCRITURA)
  @Put('suscripcion')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Suscribe este dispositivo (idempotente)',
    description:
      'Lo que da `PushSubscription.toJSON()` con `keys` renombrado a `claves`. Solo se aceptan ' +
      'servicios push de navegadores: cualquier otra URL es 400 (la API haría un POST a ella).',
  })
  @ApiResponse({ status: 204, description: 'Guardada' })
  @ApiResponse({ status: 403, description: 'REGISTRO_INCOMPLETO' })
  async suscribir(
    @ResidenteActual() residenteId: string,
    @Body() cuerpo: SuscripcionPushDto,
  ): Promise<void> {
    await this.notificaciones.suscribir(residenteId, cuerpo);
  }

  @ApiBearerAuth()
  @Throttle(THROTTLE_ESCRITURA)
  @Delete('suscripcion')
  @HttpCode(204)
  @ApiOperation({ summary: 'Da de baja este dispositivo (al cerrar sesión o desactivarlas)' })
  @ApiResponse({ status: 204, description: 'Borrada, o no existía' })
  async darDeBaja(
    @ResidenteActual() residenteId: string,
    @Body() cuerpo: BajaSuscripcionDto,
  ): Promise<void> {
    await this.notificaciones.darDeBaja(residenteId, cuerpo.endpoint);
  }

  @ApiBearerAuth()
  @UseGuards(RegistroGuard)
  @Throttle(THROTTLE_LECTURA)
  @Get('preferencias')
  @ApiOperation({ summary: 'Recordatorios y «llegó el agua» de noche' })
  @ApiResponse({ status: 200, type: PreferenciasRespuesta })
  preferencias(@ResidenteActual() residenteId: string): Promise<PreferenciasNotificacionesDto> {
    return this.notificaciones.preferencias(residenteId);
  }

  @ApiBearerAuth()
  @UseGuards(RegistroGuard)
  @Throttle(THROTTLE_ESCRITURA)
  @Patch('preferencias')
  @ApiOperation({ summary: 'Cambia las preferencias (solo los campos enviados)' })
  @ApiResponse({ status: 200, type: PreferenciasRespuesta })
  actualizarPreferencias(
    @ResidenteActual() residenteId: string,
    @Body() cuerpo: PreferenciasDto,
  ): Promise<PreferenciasNotificacionesDto> {
    return this.notificaciones.actualizarPreferencias(residenteId, cuerpo);
  }

  @ApiBearerAuth()
  @Throttle(THROTTLE_ESCRITURA)
  @Post(':id/abierta')
  @HttpCode(204)
  @ApiOperation({
    summary: 'La app se abrió desde una notificación',
    description:
      'Mide la tasa de apertura y la pausa de recordatorios. Con un id ajeno no hace nada.',
  })
  @ApiResponse({ status: 204, description: 'Anotada (o nada que anotar)' })
  async marcarAbierta(
    @ResidenteActual() residenteId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<void> {
    await this.notificaciones.marcarAbierta(residenteId, id);
  }

  @Public()
  @Throttle(THROTTLE_LECTURA)
  @Get('imagen/:sectorId/:tipoServicio')
  @ApiOperation({
    summary: 'Imagen de la notificación: el sector y sus 6 vecinos, coloreados por estado',
    description: 'PNG de 720 × 360. Solo hexágonos, como el mapa público: nunca personas (NF-06).',
  })
  @ApiResponse({ status: 200, description: 'image/png' })
  @ApiResponse({ status: 404, description: 'SECTOR_NO_ENCONTRADO' })
  async imagen(
    @Param() p: ImagenParamsDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const png = await this.imagenes.png(p.sectorId, p.tipoServicio);
    // Las cabeceras van solo con la imagen: un 404 sigue siendo JSON. La pide el sistema del
    // teléfono desde el service worker de la web (otro origen): sin `cross-origin`, Helmet la
    // bloquearía con `Cross-Origin-Resource-Policy: same-origin`.
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    return new StreamableFile(png, { type: 'image/png' });
  }
}
