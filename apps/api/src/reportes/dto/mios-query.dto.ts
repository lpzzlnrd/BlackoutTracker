import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

export class MiosQueryDto {
  @ApiPropertyOptional({
    type: Boolean,
    description: 'Solo los reportes abiertos (sin cierre y no vencidos). Por defecto, todos.',
  })
  @IsOptional()
  // La query llega como texto: solo "true" y "false" valen; cualquier otra cosa falla en @IsBoolean.
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  abiertos?: boolean;
}
