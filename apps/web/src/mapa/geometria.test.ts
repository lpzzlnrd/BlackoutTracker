import type { SectorFeatureDto } from '@blackout/shared';
import { booleanPointInPolygon } from '@turf/boolean-point-in-polygon';
import { describe, expect, it } from 'vitest';
import { contiene, puntoEtiqueta } from './geometria';
import { anchoNombre, escaparHtml, marcadorSector } from './marcador';

const sector = (anillo: [number, number][]): SectorFeatureDto => ({
  type: 'Feature',
  id: 1,
  properties: { id: 1, nombre: 'Sector 1' },
  geometry: { type: 'MultiPolygon', coordinates: [[anillo]] },
});

const dentro = (s: SectorFeatureDto, [lat, lng]: [number, number]) =>
  booleanPointInPolygon([lng, lat], s as unknown as Parameters<typeof booleanPointInPolygon>[1]);

describe('puntoEtiqueta', () => {
  it('VIS-01: en un sector convexo usa el centro de masa, en orden [lat, lng]', () => {
    const cuadrado = sector([
      [-68.02, 10.2],
      [-68.0, 10.2],
      [-68.0, 10.22],
      [-68.02, 10.22],
      [-68.02, 10.2],
    ]);
    const [lat, lng] = puntoEtiqueta(cuadrado);
    expect(lat).toBeCloseTo(10.21, 6);
    expect(lng).toBeCloseTo(-68.01, 6);
  });

  it('VIS-01: en un sector cóncavo (en U) la etiqueta cae dentro, no en el hueco', () => {
    // Una U: el centro de masa cae en la abertura, fuera del polígono.
    const u = sector([
      [0, 0],
      [3, 0],
      [3, 3],
      [2, 3],
      [2, 1],
      [1, 1],
      [1, 3],
      [0, 3],
      [0, 0],
    ]);
    expect(dentro(u, puntoEtiqueta(u))).toBe(true);
  });
});

describe('contiene', () => {
  it('VIS-05: un sector angosto e inclinado no contiene los puntos de su rectángulo envolvente', () => {
    // Franja diagonal: su rectángulo envolvente es el cuadrado 0..1, pero el sector no lo llena.
    const franja = sector([
      [0, 0],
      [0.2, 0],
      [1, 0.8],
      [1, 1],
      [0.8, 1],
      [0, 0.2],
      [0, 0],
    ]);
    expect(contiene(franja, 0.5, 0.5)).toBe(true);
    expect(contiene(franja, 0.9, 0.1)).toBe(false);
    expect(contiene(franja, 0.1, 0.9)).toBe(false);
  });
});

describe('marcadorSector', () => {
  it('VIS-01: la píldora "Tu sector" solo va en el sector propio', () => {
    expect(
      marcadorSector({ nombre: 'Sector 1', estado: 'sin-servicio', propio: true }).html,
    ).toContain('Tu sector');
    expect(
      marcadorSector({ nombre: 'Sector 2', estado: 'con-servicio', propio: false }).html,
    ).not.toContain('Tu sector');
  });

  it('VIS-01: la insignia lleva la clase de su estado (color, icono y texto, nunca solo color)', () => {
    const { html } = marcadorSector({ nombre: 'Sector 3', estado: 'sin-confirmar', propio: false });
    expect(html).toContain('marcador-insignia--sin-confirmar');
    expect(html).toContain('Sector 3');
  });

  it('VIS-01: el nombre que llega de la API se escapa antes de entrar al HTML', () => {
    expect(escaparHtml('<b>"Sector" & \'1\'</b>')).toBe(
      '&lt;b&gt;&quot;Sector&quot; &amp; &#39;1&#39;&lt;/b&gt;',
    );
    expect(
      marcadorSector({ nombre: '<img src=x>', estado: 'sin-datos', propio: false }).html,
    ).not.toContain('<img');
  });

  it('VIS-05: en un sector diminuto (teléfono pequeño) solo va la insignia, centrada', () => {
    const { html, ancla } = marcadorSector({
      nombre: 'Sector 1',
      estado: 'sin-servicio',
      propio: true,
      compacto: true,
    });
    expect(html).not.toContain('Sector 1');
    expect(html).not.toContain('Tu sector');
    expect(html).toContain('marcador-insignia--sin-servicio');
    expect(ancla).toEqual([12, 12]);
  });

  it('VIS-01: el ancla cae en el centro de la píldora, también con "Tu sector" encima', () => {
    expect(marcadorSector({ nombre: 'S', estado: 'con-servicio', propio: false }).ancla).toEqual([
      100, 15,
    ]);
    expect(marcadorSector({ nombre: 'S', estado: 'con-servicio', propio: true }).ancla).toEqual([
      100, 39,
    ]);
  });
});

describe('anchoNombre', () => {
  it('VIS-05: un nombre más largo o una letra más grande piden más ancho', () => {
    const corto = anchoNombre('Norte', 14);
    expect(anchoNombre('Noroeste', 14)).toBeGreaterThan(corto);
    expect(anchoNombre('Norte', 18)).toBeGreaterThan(corto);
  });

  it('VIS-05: "Guaparo Noroeste" no cabe en un sector de 160 px de ancho a 16 px; "Noroeste" sí', () => {
    // El caso de la captura del 27-oct: con el zoom alejado, los nombres vecinos se pisaban. La
    // píldora de D-038 suma la insignia y el relleno al texto.
    expect(anchoNombre('Guaparo Noroeste', 16)).toBeGreaterThan(160);
    expect(anchoNombre('Noroeste', 16)).toBeLessThanOrEqual(160);
  });
});
