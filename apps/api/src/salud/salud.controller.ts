import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { sql } from 'drizzle-orm';
import type { SaludDto } from '@blackout/shared';
import { Public } from '../auth/publico.decorator';
import { type BaseDeDatos, DB } from '../db/db.module';

@ApiTags('salud')
@Public()
@Controller('salud')
export class SaludController {
  constructor(@Inject(DB) private readonly db: BaseDeDatos) {}

  @Get()
  @ApiOperation({ summary: 'Estado de la API y de la base (sirve también de keep-alive)' })
  async obtener(): Promise<SaludDto> {
    // Tocar la base evita que Supabase pause el proyecto por inactividad (docs/PLAN.md §10).
    const baseDeDatos = await this.db.execute(sql`select 1`).then(
      () => 'ok' as const,
      () => 'error' as const,
    );
    return {
      estado: baseDeDatos === 'ok' ? 'ok' : 'degradado',
      baseDeDatos,
      hora: new Date().toISOString(),
    };
  }
}
