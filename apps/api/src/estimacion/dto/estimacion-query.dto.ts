import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, Max, Min } from 'class-validator';
import { TIPOS_SERVICIO, type TipoServicio } from '@blackout/shared';

export class EstimacionQueryDto {
  @ApiProperty({ example: 1, description: 'Id del sector.' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  // Igual que en `SectorParamDto`: `sectores.id` es smallint y un número mayor rompía la consulta (500).
  @Max(32_767)
  sectorId!: number;

  @ApiProperty({ enum: TIPOS_SERVICIO, description: 'Agua y luz nunca se mezclan (EST-05).' })
  @IsIn(TIPOS_SERVICIO)
  tipoServicio!: TipoServicio;
}

/** Documenta en Swagger las dos formas de `EstimacionDto`. */
export class EstimacionRespuesta {
  @ApiProperty({ description: 'false con menos de n_min cortes cerrados: no hay cifra (EST-04).' })
  suficiente!: boolean;

  @ApiProperty({ example: 12, description: 'Cortes cerrados que entran en el cálculo.' })
  n!: number;

  @ApiProperty({
    required: false,
    example: 240,
    description: 'Mediana de la duración, en minutos.',
  })
  medianaMin?: number;

  @ApiProperty({ required: false, description: 'Primer cuartil, en minutos.' })
  q1Min?: number;

  @ApiProperty({ required: false, description: 'Tercer cuartil, en minutos.' })
  q3Min?: number;
}
