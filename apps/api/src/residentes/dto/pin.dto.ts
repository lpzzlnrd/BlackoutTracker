import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Max, Min } from 'class-validator';
import type { PinDto as PinInterfaz } from '@blackout/shared';
import { GeometriaMultiPoligono } from '../../sectores/dto/sectores.dto';

const NUMERO = { allowNaN: false, allowInfinity: false } as const;

/** El pin del residente. `lat` y `lng` van por separado y con nombre: nunca como un arreglo `[a, b]`. */
export class PinDto implements PinInterfaz {
  @ApiProperty({ example: 10.2075, description: 'Latitud (−90 a 90)' })
  @IsNumber(NUMERO)
  @Min(-90)
  @Max(90)
  lat!: number;

  @ApiProperty({ example: -68.003, description: 'Longitud (−180 a 180)' })
  @IsNumber(NUMERO)
  @Min(-180)
  @Max(180)
  lng!: number;
}

export class SectorAsignadoRespuesta {
  @ApiProperty() sectorId!: number;
  @ApiProperty() sectorNombre!: string;
  @ApiProperty({ example: 'Valencia' }) municipio!: string;
}

export class PinValidadoRespuesta {
  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'null si nadie se ha registrado aún en esa celda: el sector se crea al confirmar',
  })
  sectorId!: number | null;
  @ApiProperty({ example: 'Guaparo' }) sectorNombre!: string;
  @ApiProperty({ example: 'Valencia' }) municipio!: string;
  @ApiProperty({
    type: GeometriaMultiPoligono,
    description: 'El hexágono del sector, nunca el pin',
  })
  geometria!: GeometriaMultiPoligono;
}
