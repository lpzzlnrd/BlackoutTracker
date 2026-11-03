import { cellToLatLng, getResolution, isValidCell } from 'h3-js';
import { RESOLUCION_H3, celdaDe, centroDe, hexagonoDe, nombreLibre } from './h3.puro';

// Guaparo, en el municipio Valencia.
const GUAPARO = { lat: 10.2195, lng: -68.0145 };

describe('celdas H3 de los sectores (T-070, D-040)', () => {
  it('REG-01: un pin cae en una celda válida de resolución 8', () => {
    const celda = celdaDe(GUAPARO.lat, GUAPARO.lng);
    expect(isValidCell(celda)).toBe(true);
    expect(getResolution(celda)).toBe(RESOLUCION_H3);
    expect(celda).toBe('8867432a23fffff');
  });

  it('REG-03: siempre da la misma celda para el mismo punto, sin empates en los bordes', () => {
    expect(celdaDe(GUAPARO.lat, GUAPARO.lng)).toBe(celdaDe(GUAPARO.lat, GUAPARO.lng));
  });

  it('REG-01: lat y lng no se confunden (el punto intercambiado cae en otra celda)', () => {
    expect(celdaDe(GUAPARO.lng, GUAPARO.lat)).not.toBe(celdaDe(GUAPARO.lat, GUAPARO.lng));
  });

  it('el centro de la celda es el de h3-js y vuelve a caer en la misma celda', () => {
    const celda = celdaDe(GUAPARO.lat, GUAPARO.lng);
    const { lat, lng } = centroDe(celda);
    expect([lat, lng]).toEqual(cellToLatLng(celda));
    expect(celdaDe(lat, lng)).toBe(celda);
  });

  it('el hexágono es un MultiPolygon GeoJSON cerrado de 6 vértices, en [lng, lat]', () => {
    const { type, coordinates } = hexagonoDe(celdaDe(GUAPARO.lat, GUAPARO.lng));
    expect(type).toBe('MultiPolygon');
    expect(coordinates).toHaveLength(1);
    const [[anillo = []] = []] = coordinates;
    expect(anillo).toHaveLength(7);
    expect(anillo[0]).toEqual(anillo[6]);
    for (const [lng = 0, lat = 0] of anillo) {
      expect(lng).toBeCloseTo(GUAPARO.lng, 1);
      expect(lat).toBeCloseTo(GUAPARO.lat, 1);
    }
  });
});

describe('nombreLibre', () => {
  it('usa el nombre del lugar si está libre', () => {
    expect(nombreLibre('Guaparo', ['La Viña'])).toBe('Guaparo');
  });

  it('numera desde 2 cuando el nombre ya lo tiene otro sector', () => {
    expect(nombreLibre('Guaparo', ['Guaparo'])).toBe('Guaparo 2');
  });

  it('salta los números tomados y rellena huecos', () => {
    expect(nombreLibre('Guaparo', ['Guaparo', 'Guaparo 2', 'Guaparo 3'])).toBe('Guaparo 4');
    expect(nombreLibre('Guaparo', ['Guaparo', 'Guaparo 3'])).toBe('Guaparo 2');
  });

  it('no confunde otro lugar que empieza igual', () => {
    expect(nombreLibre('Prebo', ['Prebo I', 'Prebo II'])).toBe('Prebo');
  });
});
