import type { GeometriaMultiPoligonoDto } from '@blackout/shared';

type Anillo = number[][];

/** Trazado de rayos sobre un anillo `[lng, lat]`. Un punto sobre el borde puede caer a cualquier lado. */
function dentroDeAnillo(lng: number, lat: number, anillo: Anillo): boolean {
  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i] as [number, number];
    const [xj, yj] = anillo[j] as [number, number];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

/** El primer anillo de cada polígono es el exterior; los demás son huecos. */
export function puntoEnMultiPoligono(
  lng: number,
  lat: number,
  geometria: GeometriaMultiPoligonoDto,
): boolean {
  return geometria.coordinates.some(([exterior, ...huecos]) =>
    exterior
      ? dentroDeAnillo(lng, lat, exterior) && !huecos.some((h) => dentroDeAnillo(lng, lat, h))
      : false,
  );
}
