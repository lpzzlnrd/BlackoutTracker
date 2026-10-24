import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsISO8601, Matches } from 'class-validator';
import { type IniciarReporteSolicitud, TIPOS_SERVICIO, type TipoServicio } from '@blackout/shared';

export class IniciarReporteDto implements IniciarReporteSolicitud {
  @ApiProperty({ enum: TIPOS_SERVICIO })
  @IsIn(TIPOS_SERVICIO)
  tipoServicio!: TipoServicio;

  @ApiProperty({
    example: '2026-10-07T10:30:00Z',
    description: 'Hora real del corte (no la del envío). ISO 8601 con zona horaria.',
  })
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/, {
    message: 'ocurridoEn debe incluir la zona horaria (Z o ±hh:mm)',
  })
  ocurridoEn!: string;
}

export class ReporteRespuesta {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: TIPOS_SERVICIO }) tipoServicio!: TipoServicio;
  @ApiProperty() sectorId!: number;
  @ApiProperty() inicioEn!: string;
  @ApiProperty({ nullable: true, type: String }) finEn!: string | null;
  @ApiProperty({ nullable: true, type: Number }) duracionMin!: number | null;
  @ApiProperty() recibidoEn!: string;
}
