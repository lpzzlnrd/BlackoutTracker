import {
  createServer,
  request as peticionHttp,
  type ClientRequest,
  type IncomingHttpHeaders,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import { request as peticionHttps } from 'node:https';
import type { AddressInfo } from 'node:net';

/**
 * Qué le pasa a una petición al cruzar la red simulada:
 * - `pasa`: llega y vuelve sin problemas.
 * - `corta-antes`: la conexión se cae antes de llegar a la API (nada se procesa).
 * - `corta-envio`: la API recibe la mitad del cuerpo y la conexión se cae (no se procesa).
 * - `corta-despues`: la API procesa y confirma, pero la respuesta se pierde (OFF-05 de verdad).
 * - `lenta`: llega con una demora al azar; si supera el timeout del cliente, este reintenta
 *   mientras la petición original sigue en camino.
 */
export type Suerte = 'pasa' | 'corta-antes' | 'corta-envio' | 'corta-despues' | 'lenta';

export interface OpcionesProxy {
  /** URL base de la API real (http o https), p. ej. `http://127.0.0.1:3000`. */
  destino: string;
  /** Probabilidad (0..1) de cada desenlace; el resto, `pasa`. */
  probCortaAntes: number;
  probCortaEnvio: number;
  probCortaDespues: number;
  probLenta: number;
  /** Demora máxima de una petición `lenta`. */
  latenciaMaxMs: number;
  /** Caídas totales de la red: cada cuánto empiezan y cuánto duran (rangos en ms). Sin esto, no hay. */
  caidas?: { cadaMs: [number, number]; duracionMs: [number, number] };
  /** Generador de azar (los tests pueden fijarlo). */
  azar?: () => number;
}

export interface EstadisticasProxy {
  peticiones: number;
  pasan: number;
  cortadasAntes: number;
  cortadasEnvio: number;
  /** Peticiones que la API procesó y cuya respuesta nunca llegó al cliente. */
  cortadasDespues: number;
  lentas: number;
  /** Peticiones rechazadas porque la red estaba caída. */
  enCaida: number;
  caidas: number;
}

/** Cabeceras que no se reenvían: las de la conexión las pone cada salto. */
const SALTO_A_SALTO = new Set(['host', 'connection', 'keep-alive', 'transfer-encoding']);

function sinSaltos(cabeceras: IncomingHttpHeaders): IncomingHttpHeaders {
  return Object.fromEntries(
    Object.entries(cabeceras).filter(([nombre]) => !SALTO_A_SALTO.has(nombre)),
  );
}

/**
 * Proxy HTTP local que se interpone entre el cliente simulado y la API y decide al azar la suerte
 * de cada petición (T-054, NF-04). Trabaja a nivel HTTP y no TCP para poder cortar *después* de que
 * la API respondió también cuando la API está detrás de HTTPS (Render).
 */
export class ProxyIntermitente {
  readonly estadisticas: EstadisticasProxy = {
    peticiones: 0,
    pasan: 0,
    cortadasAntes: 0,
    cortadasEnvio: 0,
    cortadasDespues: 0,
    lentas: 0,
    enCaida: 0,
    caidas: 0,
  };

  private readonly servidor: Server;
  private readonly destino: URL;
  private readonly azar: () => number;
  private readonly enCurso = new Set<ClientRequest>();
  private readonly temporizadores = new Set<NodeJS.Timeout>();
  private caida = false;
  private calma = false;
  private puerto = 0;

  constructor(private readonly opciones: OpcionesProxy) {
    this.destino = new URL(opciones.destino);
    this.azar = opciones.azar ?? Math.random;
    this.servidor = createServer((req, res) => this.atender(req, res));
  }

  /** URL base del proxy: el cliente la usa en lugar de la de la API. */
  get url(): string {
    return `http://127.0.0.1:${this.puerto}`;
  }

  async abrir(): Promise<void> {
    await new Promise<void>((resolve) => this.servidor.listen(0, '127.0.0.1', resolve));
    this.puerto = (this.servidor.address() as AddressInfo).port;
    if (this.opciones.caidas) this.programarCaida();
  }

  /** La red se estabiliza: deja de cortar, de demorar y de caerse (fase de drenaje). */
  calmar(): void {
    this.calma = true;
    this.caida = false;
    for (const t of this.temporizadores) clearTimeout(t);
    this.temporizadores.clear();
  }

  /** Cierra el proxy y aborta lo que siga en camino hacia la API. */
  async cerrar(): Promise<void> {
    this.calmar();
    for (const r of this.enCurso) r.destroy();
    this.servidor.closeAllConnections();
    await new Promise<void>((resolve) => this.servidor.close(() => resolve()));
  }

  private entre([min, max]: [number, number]): number {
    return min + this.azar() * (max - min);
  }

  private demorar(ms: number, accion: () => void): void {
    const t = setTimeout(() => {
      this.temporizadores.delete(t);
      accion();
    }, ms);
    this.temporizadores.add(t);
  }

  private programarCaida(): void {
    const { cadaMs, duracionMs } = this.opciones.caidas!;
    this.demorar(this.entre(cadaMs), () => {
      this.caida = true;
      this.estadisticas.caidas += 1;
      this.demorar(this.entre(duracionMs), () => {
        this.caida = false;
        this.programarCaida();
      });
    });
  }

  private sortear(): Suerte {
    if (this.calma) return 'pasa';
    const o = this.opciones;
    let x = this.azar();
    for (const [suerte, p] of [
      ['corta-antes', o.probCortaAntes],
      ['corta-envio', o.probCortaEnvio],
      ['corta-despues', o.probCortaDespues],
      ['lenta', o.probLenta],
    ] as const) {
      if (x < p) return suerte;
      x -= p;
    }
    return 'pasa';
  }

  private atender(req: IncomingMessage, res: ServerResponse): void {
    this.estadisticas.peticiones += 1;
    if (this.caida) {
      this.estadisticas.enCaida += 1;
      req.socket.destroy();
      return;
    }
    const suerte = this.sortear();
    if (suerte === 'corta-antes') {
      this.estadisticas.cortadasAntes += 1;
      req.socket.destroy();
      return;
    }

    const trozos: Buffer[] = [];
    req.on('data', (t: Buffer) => trozos.push(t));
    req.on('end', () => {
      const cuerpo = Buffer.concat(trozos);
      if (suerte === 'lenta') {
        this.estadisticas.lentas += 1;
        this.demorar(this.azar() * this.opciones.latenciaMaxMs, () =>
          this.reenviar(req, res, cuerpo, suerte),
        );
      } else {
        this.reenviar(req, res, cuerpo, suerte);
      }
    });
  }

  private reenviar(
    req: IncomingMessage,
    res: ServerResponse,
    cuerpo: Buffer,
    suerte: Suerte,
  ): void {
    const pedir = this.destino.protocol === 'https:' ? peticionHttps : peticionHttp;
    const salida = pedir({
      protocol: this.destino.protocol,
      hostname: this.destino.hostname,
      port: this.destino.port,
      method: req.method,
      path: req.url,
      headers: { ...sinSaltos(req.headers), 'content-length': String(cuerpo.length) },
      agent: false,
    });
    this.enCurso.add(salida);
    salida.on('close', () => this.enCurso.delete(salida));
    salida.on('error', () => req.socket.destroy());

    if (suerte === 'corta-envio' && cuerpo.length > 1) {
      // La API recibe la cabecera y medio cuerpo; luego se cae la conexión en los dos tramos.
      this.estadisticas.cortadasEnvio += 1;
      salida.write(cuerpo.subarray(0, Math.floor(cuerpo.length / 2)));
      this.demorar(20, () => {
        salida.destroy();
        req.socket.destroy();
      });
      return;
    }

    salida.on('response', (respuesta) => {
      const trozos: Buffer[] = [];
      respuesta.on('data', (t: Buffer) => trozos.push(t));
      respuesta.on('end', () => {
        if (suerte === 'corta-despues') {
          // La respuesta completa llegó al proxy: la API ya confirmó la transacción.
          this.estadisticas.cortadasDespues += 1;
          req.socket.destroy();
          return;
        }
        if (suerte === 'pasa' || suerte === 'corta-envio') this.estadisticas.pasan += 1;
        if (res.destroyed) return;
        res.writeHead(respuesta.statusCode ?? 502, sinSaltos(respuesta.headers));
        res.end(Buffer.concat(trozos));
      });
    });
    salida.end(cuerpo);
  }
}
