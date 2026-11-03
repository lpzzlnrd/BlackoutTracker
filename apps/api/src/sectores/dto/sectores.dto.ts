import { ApiProperty } from '@nestjs/swagger';

class SectorPropiedades {
  @ApiProperty() id!: number;
  @ApiProperty() nombre!: string;
  @ApiProperty({ example: 'Valencia', description: 'Municipio del centro del hexágono' })
  municipio!: string;
}

export class GeometriaMultiPoligono {
  @ApiProperty({ example: 'MultiPolygon' }) type!: 'MultiPolygon';
  @ApiProperty({ description: 'Coordenadas [lng, lat] por polígono, anillo y vértice' })
  coordinates!: number[][][][];
}

class SectorFeature {
  @ApiProperty({ example: 'Feature' }) type!: 'Feature';
  @ApiProperty() id!: number;
  @ApiProperty({ type: SectorPropiedades }) properties!: SectorPropiedades;
  @ApiProperty({ type: GeometriaMultiPoligono }) geometry!: GeometriaMultiPoligono;
}

export class SectoresGeoJsonRespuesta {
  @ApiProperty({ example: 'FeatureCollection' }) type!: 'FeatureCollection';
  @ApiProperty({ type: [SectorFeature] }) features!: SectorFeature[];
}

class ZonaPropiedades {
  @ApiProperty({ example: ['Valencia', 'Naguanagua', 'San Diego', 'Los Guayos', 'Libertador'] })
  municipios!: string[];
}

export class ZonaRespuesta {
  @ApiProperty({ example: 'Feature' }) type!: 'Feature';
  @ApiProperty({ type: ZonaPropiedades }) properties!: ZonaPropiedades;
  @ApiProperty({ type: GeometriaMultiPoligono }) geometry!: GeometriaMultiPoligono;
}
