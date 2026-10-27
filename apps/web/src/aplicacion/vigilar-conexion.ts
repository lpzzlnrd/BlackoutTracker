import type { Puertos } from '../datos/puertos';

export interface OpcionesVigilancia {
  puertos: Pick<Puertos, 'conexion' | 'sondaSalud' | 'reloj'>;
  /** Se llama al recuperar la red y al arrancar con red: normalmente, el sincronizador de la cola. */
  sincronizar: () => Promise<unknown>;
  /** Donde llega el evento `online`. Por defecto, `window` (en Node, un `EventTarget` vacío). */
  objetivo?: EventTarget;
  /** Esperas entre sondeos de `GET /salud`; la última se repite. */
  esperasMs?: number[];
  esperar?: (ms: number) => Promise<void>;
}

const ESPERAS_POR_DEFECTO = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000];

/**
 * Detecta la vuelta de la red y dispara la sincronización (PWA.md §7). No se fía de
 * `navigator.onLine`: mientras la conexión no esté `en-linea` (por el evento `offline` o por una
 * petición fallida) sondea `GET /salud` con espera creciente, y solo al primer `ok` declara la
 * vuelta y sincroniza. Devuelve la función que lo detiene.
 */
export function vigilarConexion(opciones: OpcionesVigilancia): () => void {
  const { puertos, sincronizar } = opciones;
  const objetivo =
    opciones.objetivo ?? (typeof window === 'undefined' ? new EventTarget() : window);
  const esperas = opciones.esperasMs ?? ESPERAS_POR_DEFECTO;
  const esperar =
    opciones.esperar ?? ((ms: number) => new Promise<void>((resolver) => setTimeout(resolver, ms)));

  let detenido = false;
  let sondeando = false;
  /** Corta la espera en curso: el evento `online` no debe aguardar los 30 s de un sondeo lento. */
  let despertar: (() => void) | null = null;

  const dormir = (ms: number) =>
    new Promise<void>((resolver) => {
      despertar = resolver;
      void esperar(ms).then(resolver);
    });

  async function sondear(inmediato: boolean): Promise<void> {
    if (sondeando || detenido) return;
    sondeando = true;
    try {
      for (let intento = inmediato ? -1 : 0; !detenido; intento += 1) {
        if (intento >= 0) await dormir(esperas[Math.min(intento, esperas.length - 1)] ?? 0);
        if (detenido) return;
        if (await puertos.sondaSalud.sondear()) {
          puertos.conexion.registrarExito(puertos.reloj.ahora());
          await sincronizar();
          return;
        }
      }
    } finally {
      sondeando = false;
    }
  }

  const sinRed = () => puertos.conexion.leer().modo !== 'en-linea';

  const alCambiarConexion = () => {
    if (sinRed()) void sondear(false);
  };
  const alVolverLaRed = () => {
    if (!sinRed()) return;
    if (sondeando) despertar?.();
    else void sondear(true);
  };

  const baja = puertos.conexion.suscribir(alCambiarConexion);
  objetivo.addEventListener('online', alVolverLaRed);

  if (sinRed()) void sondear(false);
  else void sincronizar();

  return () => {
    detenido = true;
    despertar?.();
    baja();
    objetivo.removeEventListener('online', alVolverLaRed);
  };
}
