// Consumidor con `moduleResolution: bundler` (Vite): usa la condición `import` del mapa `exports`,
// y sus tipos salen de `index.d.ts`.
import { CodigoError, ESTADO_HTTP_DE_CODIGO, TipoServicio } from '@blackout/shared';
import type { EstimacionDto, SectorAsignadoDto } from '@blackout/shared';

export const agua: TipoServicio = TipoServicio.Agua;
// @ts-expect-error — 'luz' no es un servicio: TipoServicio es la unión 'agua' | 'electricidad'
export const luz: TipoServicio = 'luz';

export const estadoDeHoraInvalida: 422 = ESTADO_HTTP_DE_CODIGO[CodigoError.HoraInvalida];

export function medianaMin(estimacion: EstimacionDto): number {
  if (estimacion.suficiente) return estimacion.medianaMin;
  // @ts-expect-error — con datos insuficientes no hay mediana (EST-04)
  return estimacion.medianaMin;
}

export const sector: SectorAsignadoDto = {
  sectorId: 1,
  sectorNombre: 'Guaparo',
  // @ts-expect-error — la respuesta nunca lleva las coordenadas del residente (NF-06)
  lat: 10.2,
};
