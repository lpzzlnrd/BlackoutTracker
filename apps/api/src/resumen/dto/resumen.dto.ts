import { ApiProperty } from '@nestjs/swagger';
import {
  ESTADOS_SERVICIO,
  type EstadoServicio,
  type EstimacionDto,
  type ResumenSectorDto,
  type ResumenServicioDto,
  TIPOS_SERVICIO,
  type TipoServicio,
} from '@blackout/shared';
import { EventoSectorRespuesta } from '../../historial/dto/historial.dto';
import { EstimacionRespuesta } from '../../estimacion/dto/estimacion-query.dto';

/** Documenta en Swagger la forma de `ResumenServicioDto` (las interfaces no existen en runtime). */
export class ResumenServicioRespuesta implements ResumenServicioDto {
  @ApiProperty({ enum: TIPOS_SERVICIO }) tipoServicio!: TipoServicio;
  @ApiProperty({ enum: ESTADOS_SERVICIO }) estado!: EstadoServicio;
  @ApiProperty({
    description: 'Reportes de inicio que todavía no alcanzan el consenso (CON-01).',
  })
  reportesSinConfirmar!: number;
  @ApiProperty({ nullable: true, type: String, description: 'Inicio del corte en curso.' })
  desde!: string | null;
  @ApiProperty({ type: EstimacionRespuesta }) estimacion!: EstimacionDto;
  @ApiProperty({
    type: [EventoSectorRespuesta],
    description: 'Los 5 más recientes, el más nuevo primero; incluye el corte en curso.',
  })
  ultimosEventos!: EventoSectorRespuesta[];
}

export class ResumenSectorRespuesta implements ResumenSectorDto {
  @ApiProperty() sectorId!: number;
  @ApiProperty() sectorNombre!: string;
  @ApiProperty({ type: [ResumenServicioRespuesta], description: 'Un elemento por servicio.' })
  servicios!: ResumenServicioRespuesta[];
}
