import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Max, Min } from 'class-validator';
import type { PinDto as PinInterfaz } from '@blackout/shared';

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
}
