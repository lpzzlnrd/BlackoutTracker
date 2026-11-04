import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  type BajaSuscripcionSolicitud,
  type ClavePushDto,
  type PreferenciasNotificacionesDto,
  type SuscripcionPushSolicitud,
  TIPOS_SERVICIO,
  type TipoServicio,
} from '@blackout/shared';

/** base64url, con o sin relleno, como lo entrega `PushSubscription.toJSON()`. */
const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/;

export class ClavesPushDto {
  @ApiProperty({ description: 'Clave pública P-256 del navegador (65 bytes en base64url)' })
  @IsString()
  @Matches(BASE64URL)
  @MaxLength(100)
  p256dh!: string;

  @ApiProperty({ description: 'Secreto de autenticación del navegador (16 bytes en base64url)' })
  @IsString()
  @Matches(BASE64URL)
  @MaxLength(32)
  auth!: string;
}

export class SuscripcionPushDto implements SuscripcionPushSolicitud {
  @ApiProperty({
    example: 'https://fcm.googleapis.com/fcm/send/…',
    description: 'Solo servicios push de navegadores (FCM, Mozilla, Apple, Windows)',
  })
  @IsUrl({ protocols: ['https'], require_protocol: true, require_tld: true })
  @MaxLength(1024)
  endpoint!: string;

  @ApiProperty({ type: ClavesPushDto })
  @ValidateNested()
  @Type(() => ClavesPushDto)
  claves!: ClavesPushDto;
}

export class BajaSuscripcionDto implements BajaSuscripcionSolicitud {
  @ApiProperty()
  @IsString()
  @MaxLength(1024)
  endpoint!: string;
}

export class PreferenciasDto implements Partial<PreferenciasNotificacionesDto> {
  @ApiPropertyOptional({ description: 'Recordatorios y preguntas (máximo uno al día por defecto)' })
  @IsOptional()
  @IsBoolean()
  recordatorios?: boolean;

  @ApiPropertyOptional({ description: '«Llegó el agua» suena aunque sea de noche' })
  @IsOptional()
  @IsBoolean()
  aguaDeNoche?: boolean;
}

export class PreferenciasRespuesta implements PreferenciasNotificacionesDto {
  @ApiProperty() recordatorios!: boolean;
  @ApiProperty() aguaDeNoche!: boolean;
}

export class ClavePushRespuesta implements ClavePushDto {
  @ApiProperty() activo!: boolean;
  @ApiProperty({ type: String, nullable: true }) clavePublica!: string | null;
}

export class ImagenParamsDto {
  @ApiProperty({ type: Number })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(32_767) // smallint
  sectorId!: number;

  @ApiProperty({ enum: TIPOS_SERVICIO })
  @IsIn(TIPOS_SERVICIO)
  tipoServicio!: TipoServicio;
}
