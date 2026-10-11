import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { SaludDto } from '@blackout/shared';

@ApiTags('salud')
@Controller('salud')
export class SaludController {
  @Get()
  @ApiOperation({ summary: 'Estado de la API (sirve también de keep-alive)' })
  obtener(): SaludDto {
    // La comprobación de la base de datos se agrega con Drizzle (T-005).
    return { estado: 'ok', baseDeDatos: 'ok', hora: new Date().toISOString() };
  }
}
