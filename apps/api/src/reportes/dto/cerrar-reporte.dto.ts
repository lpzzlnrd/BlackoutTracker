import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, Matches } from 'class-validator';
import type { CerrarReporteSolicitud } from '@blackout/shared';

export class CerrarReporteDto implements CerrarReporteSolicitud {
  @ApiProperty({
    example: '2026-10-07T12:30:00Z',
    description:
      'Hora real en que volvió el servicio (no la del envío). ISO 8601 con zona horaria.',
  })
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/, {
    message: 'ocurridoEn debe incluir la zona horaria (Z o ±hh:mm)',
  })
  ocurridoEn!: string;
}
