import type { FechaIso } from '@blackout/shared';
import type { Reloj } from '../../puertos';

export interface RelojMock extends Reloj {
  /** Adelanta el reloj, p. ej. para vencer una ventana en un test. */
  avanzar(ms: number): void;
  fijar(iso: FechaIso): void;
}

/** Reloj detenido: solo se mueve si alguien lo mueve. */
export function crearRelojMock(inicial: FechaIso): RelojMock {
  let ms = Date.parse(inicial);
  return {
    ahora: () => new Date(ms).toISOString(),
    avanzar(delta) {
      ms += delta;
    },
    fijar(iso) {
      ms = Date.parse(iso);
    },
  };
}
