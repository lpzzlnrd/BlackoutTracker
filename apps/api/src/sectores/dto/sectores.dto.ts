import { ApiProperty } from '@nestjs/swagger';

class SectorPropiedades {
  @ApiProperty() id!: number;
  @ApiProperty() nombre!: string;
}

class SectorGeometria {
  @ApiProperty({ example: 'MultiPolygon' }) type!: 'MultiPolygon';
  @ApiProperty({ description: 'Coordenadas [lng, lat] por polígono, anillo y vértice' })
  coordinates!: number[][][][];
}

class SectorFeature {
  @ApiProperty({ example: 'Feature' }) type!: 'Feature';
  @ApiProperty() id!: number;
  @ApiProperty({ type: SectorPropiedades }) properties!: SectorPropiedades;
  @ApiProperty({ type: SectorGeometria }) geometry!: SectorGeometria;
}

export class SectoresGeoJsonRespuesta {
  @ApiProperty({ example: 'FeatureCollection' }) type!: 'FeatureCollection';
  @ApiProperty({ type: [SectorFeature] }) features!: SectorFeature[];
}
