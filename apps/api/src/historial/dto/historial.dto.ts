import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import {
  type EventoSectorDto,
  type HistorialDto,
  type OrigenEvento,
  TIPOS_SERVICIO,
  type TipoServicio,
} from '@blackout/shared';

/** Tope de eventos por página. */
export const HISTORIAL_LIMITE_MAX = 50;
export const HISTORIAL_LIMITE_POR_DEFECTO = 20;

export class SectorParamDto {
  @ApiProperty({ type: Number, description: 'Id del sector.' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(32_767) // smallint
  id!: number;
}

export class HistorialQueryDto {
  @ApiPropertyOptional({ enum: TIPOS_SERVICIO, description: 'Sin filtro, ambos servicios.' })
  @IsOptional()
  @IsIn(TIPOS_SERVICIO)
  tipoServicio?: TipoServicio;

  @ApiPropertyOptional({ description: '`siguienteCursor` de la página anterior.' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/^[A-Za-z0-9_-]+$/, { message: 'cursor inválido' })
  cursor?: string;

  @ApiPropertyOptional({
    type: Number,
    minimum: 1,
    maximum: HISTORIAL_LIMITE_MAX,
    default: HISTORIAL_LIMITE_POR_DEFECTO,
    description: 'Eventos por página.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(HISTORIAL_LIMITE_MAX)
  limite?: number;
}

export class EventoSectorRespuesta implements EventoSectorDto {
  @ApiProperty() id!: number;
  @ApiProperty() sectorId!: number;
  @ApiProperty({ enum: TIPOS_SERVICIO }) tipoServicio!: TipoServicio;
  @ApiProperty() inicioEn!: string;
  @ApiProperty({ nullable: true, type: String }) finEn!: string | null;
  @ApiProperty({ nullable: true, type: Number }) duracionMin!: number | null;
  @ApiProperty() confirmadoEn!: string;
  @ApiProperty({ enum: ['consenso', 'campo'] }) origen!: OrigenEvento;
}

export class HistorialRespuesta implements HistorialDto {
  @ApiProperty({ type: [EventoSectorRespuesta] }) eventos!: EventoSectorRespuesta[];
  @ApiProperty({ nullable: true, type: String }) siguienteCursor!: string | null;
}
