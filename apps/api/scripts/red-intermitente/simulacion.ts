import { randomUUID } from 'node:crypto';
import { request as peticionHttp } from 'node:http';
import { request as peticionHttps } from 'node:https';
import { TIPOS_SERVICIO, type TipoServicio } from '@blackout/shared';

/** Un residente ya registrado (con sector) y su JWT. */
export interface ResidenteSimulado {
  id: string;
  token: string;
}

/** Lo que el cliente cree que quedó guardado de un reporte: la verificación lo busca en la BD. */
export interface ReporteEsperado {
  id: string;
  residenteId: string;
  tipoServicio: TipoServicio;
  inicioEn: string;
  finEn: string | null;
}

type Operacion =
  | { tipo: 'inicio'; reporte: ReporteEsperado }
  | { tipo: 'cierre'; reporte: ReporteEsperado; ocurridoEn: string };

export interface OpcionesSimulacion {
  /** Base de la API vista a través de la red intermitente (con el prefijo `/api`). */
  urlApi: string;
  /** Base para el drenaje final, con la red ya estable. Por defecto, `urlApi`. */
  urlDrenaje?: string;
  residentes: ResidenteSimulado[];
  duracionMs: number;
  /** Reloj de la API (los e2e la fijan). Por defecto, el real. */
  ahora?: () => Date;
  /** Pausa entre dos operaciones de un mismo residente (rango en ms). */
  pausaMs: [number, number];
  /** Espera antes de reintentar una operación sin confirmar (rango en ms). */
  esperaReintentoMs: [number, number];
  /** Cuánto espera el cliente una respuesta antes de darla por perdida. */
  timeoutMs: number;
  /** Probabilidad de reenviar, además, una operación ya confirmada (un reintento tardío). */
  probReenvio: number;
  /** Una IP distinta en `X-Forwarded-For` por petición (solo con la API de los tests, que confía en ella). */
  ipPorPeticion?: boolean;
  /** Se llama al terminar la fase intermitente, antes del drenaje (p. ej. `proxy.calmar()`). */
  antesDeDrenar?: () => void | Promise<void>;
  azar?: () => number;
}

/** Respuesta inesperada: ni 2xx ni un fallo de red que justifique reintentar. */
export interface Inesperado {
  operacion: string;
  status: number;
  cuerpo: string;
}

export interface ResultadoSimulacion {
  esperados: ReporteEsperado[];
  operaciones: number;
  intentos: number;
  reintentos: number;
  /** Operaciones ya confirmadas que se reenviaron y volvieron a dar 200. */
  reenvios: number;
  fallosRed: number;
  timeouts: number;
  /** 5xx y 429: se reintentan como un fallo de red. */
  respuestasReintentables: number;
  /** Operaciones que quedaron en la cola al acabar la fase intermitente y salieron en el drenaje. */
  drenadas: number;
  inesperados: Inesperado[];
}

/** Desde cuándo empieza el historial simulado (las horas avanzan hasta casi `ahora`). */
const HISTORIA_MS = 2 * 24 * 60 * 60_000;
/** Intentos máximos en el drenaje, con la red estable, antes de darlo por fallido. */
const INTENTOS_DRENAJE = 20;

type Envio =
  { tipo: 'respuesta'; status: number; cuerpo: string } | { tipo: 'fallo'; timeout: boolean };

/**
 * Simula a varios residentes con la app abierta en una red intermitente (T-054, NF-04). Cada uno
 * tiene su cola en orden cronológico (OFF-04): reporta inicios y cierres de los dos servicios sin
 * abrir nunca dos del mismo (REP-05), y reintenta cada operación con el **mismo id y la misma
 * hora del evento** hasta que la API la confirma (OFF-05, OFF-03). Al final devuelve lo que el
 * cliente cree guardado, para compararlo con la BD.
 */
export async function simular(opciones: OpcionesSimulacion): Promise<ResultadoSimulacion> {
  const azar = opciones.azar ?? Math.random;
  const reloj = opciones.ahora ?? (() => new Date());
  const entre = ([min, max]: [number, number]) => min + azar() * (max - min);
  const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const r: ResultadoSimulacion = {
    esperados: [],
    operaciones: 0,
    intentos: 0,
    reintentos: 0,
    reenvios: 0,
    fallosRed: 0,
    timeouts: 0,
    respuestasReintentables: 0,
    drenadas: 0,
    inesperados: [],
  };

  const comienzo = Date.now();
  const fin = comienzo + opciones.duracionMs;
  // Hora "del evento": recorre los últimos dos días hasta casi `ahora`, siempre creciente. Así las
  // horas son válidas (ni futuras ni de más de 7 días) y la cola de cada residente es cronológica.
  const ultimaMarca = new Map<string, number>();
  const marca = (residenteId: string): string => {
    const avance = Math.min(1, (Date.now() - comienzo) / opciones.duracionMs);
    const base = reloj().getTime() - HISTORIA_MS + avance * (HISTORIA_MS - 60_000);
    const t = Math.max(Math.floor(base), (ultimaMarca.get(residenteId) ?? 0) + 1);
    ultimaMarca.set(residenteId, t);
    return new Date(t).toISOString();
  };

  const enviar = (url: string, residente: ResidenteSimulado, op: Operacion): Promise<Envio> => {
    const destino = new URL(
      op.tipo === 'inicio'
        ? `${url}/reportes/${op.reporte.id}`
        : `${url}/reportes/${op.reporte.id}/cierre`,
    );
    const cuerpo = JSON.stringify(
      op.tipo === 'inicio'
        ? { tipoServicio: op.reporte.tipoServicio, ocurridoEn: op.reporte.inicioEn }
        : { ocurridoEn: op.ocurridoEn },
    );
    const cabeceras: Record<string, string> = {
      'content-type': 'application/json',
      'content-length': String(Buffer.byteLength(cuerpo)),
      authorization: `Bearer ${residente.token}`,
      connection: 'close',
    };
    if (opciones.ipPorPeticion) {
      const n = () => Math.floor(azar() * 250) + 1;
      cabeceras['x-forwarded-for'] = `10.54.${n()}.${n()}`;
    }
    const pedir = destino.protocol === 'https:' ? peticionHttps : peticionHttp;
    r.intentos += 1;
    return new Promise<Envio>((resolve) => {
      let listo = false;
      const terminar = (e: Envio) => {
        if (!listo) {
          listo = true;
          resolve(e);
        }
      };
      const req = pedir(destino, {
        method: op.tipo === 'inicio' ? 'PUT' : 'PATCH',
        headers: cabeceras,
        agent: false,
      });
      req.setTimeout(opciones.timeoutMs, () => {
        terminar({ tipo: 'fallo', timeout: true });
        req.destroy();
      });
      req.on('error', () => terminar({ tipo: 'fallo', timeout: false }));
      req.on('response', (res) => {
        const trozos: Buffer[] = [];
        res.on('data', (t: Buffer) => trozos.push(t));
        res.on('error', () => terminar({ tipo: 'fallo', timeout: false }));
        res.on('end', () =>
          terminar({
            tipo: 'respuesta',
            status: res.statusCode ?? 0,
            cuerpo: Buffer.concat(trozos).toString('utf-8'),
          }),
        );
      });
      req.end(cuerpo);
    });
  };

  const describir = (op: Operacion) =>
    `${op.tipo === 'inicio' ? 'PUT' : 'PATCH cierre'} ${op.reporte.id} (${op.reporte.tipoServicio})`;

  /**
   * Envía hasta que la API confirma (2xx). `true` si se confirmó; `false` si se acabó el plazo con
   * la operación aún en la cola, o si la API la rechazó (queda en `inesperados`).
   */
  const enviarHastaConfirmar = async (
    url: string,
    residente: ResidenteSimulado,
    op: Operacion,
    seguir: (intento: number) => boolean,
  ): Promise<boolean | 'rechazada'> => {
    for (let intento = 0; seguir(intento); intento += 1) {
      if (intento > 0) {
        r.reintentos += 1;
        await dormir(entre(opciones.esperaReintentoMs));
      }
      const e = await enviar(url, residente, op);
      if (e.tipo === 'fallo') {
        if (e.timeout) r.timeouts += 1;
        else r.fallosRed += 1;
        continue;
      }
      if (e.status >= 200 && e.status < 300) return true;
      // El proxy de un PaaS puede responder 502/503 si la API está dormida o reiniciando, y el
      // throttle, 429: el cliente real reintenta igual que ante un corte.
      if (e.status >= 500 || e.status === 429) {
        r.respuestasReintentables += 1;
        continue;
      }
      r.inesperados.push({ operacion: describir(op), status: e.status, cuerpo: e.cuerpo });
      return 'rechazada';
    }
    return false;
  };

  /** La cola pendiente de cada residente (a lo sumo una operación: la cola es secuencial). */
  const pendientes: { residente: ResidenteSimulado; op: Operacion }[] = [];

  const aplicar = (op: Operacion) => {
    if (op.tipo === 'cierre') op.reporte.finEn = op.ocurridoEn;
  };

  const residir = async (residente: ResidenteSimulado) => {
    const abiertos = new Map<TipoServicio, ReporteEsperado>();
    const confirmadas: Operacion[] = [];
    while (Date.now() < fin) {
      const servicio = TIPOS_SERVICIO[Math.floor(azar() * TIPOS_SERVICIO.length)];
      const abierto = abiertos.get(servicio);
      let op: Operacion;
      if (abierto) {
        op = { tipo: 'cierre', reporte: abierto, ocurridoEn: marca(residente.id) };
        abiertos.delete(servicio);
      } else {
        const reporte: ReporteEsperado = {
          id: randomUUID(),
          residenteId: residente.id,
          tipoServicio: servicio,
          inicioEn: marca(residente.id),
          finEn: null,
        };
        r.esperados.push(reporte);
        abiertos.set(servicio, reporte);
        op = { tipo: 'inicio', reporte };
      }
      r.operaciones += 1;

      const resultado = await enviarHastaConfirmar(
        opciones.urlApi,
        residente,
        op,
        () => Date.now() < fin,
      );
      if (resultado === true) {
        aplicar(op);
        confirmadas.push(op);
      } else if (resultado === false) {
        pendientes.push({ residente, op });
        return;
      } else {
        // Rechazada: ya está en `inesperados`. El cliente deja de esperar ese reporte.
        if (op.tipo === 'inicio') r.esperados.splice(r.esperados.indexOf(op.reporte), 1);
        abiertos.delete(op.reporte.tipoServicio);
      }

      if (confirmadas.length > 0 && azar() < opciones.probReenvio) {
        // Un reintento tardío de algo ya confirmado: la API debe devolver lo mismo, sin duplicar.
        const vieja = confirmadas[Math.floor(azar() * confirmadas.length)];
        if (
          (await enviarHastaConfirmar(
            opciones.urlApi,
            residente,
            vieja,
            () => Date.now() < fin,
          )) === true
        ) {
          r.reenvios += 1;
        }
      }
      await dormir(entre(opciones.pausaMs));
    }
  };

  await Promise.all(opciones.residentes.map(residir));

  // La red vuelve: cada cola envía lo que le quedó pendiente (evento `online`).
  await opciones.antesDeDrenar?.();
  const urlDrenaje = opciones.urlDrenaje ?? opciones.urlApi;
  await Promise.all(
    pendientes.map(async ({ residente, op }) => {
      const resultado = await enviarHastaConfirmar(
        urlDrenaje,
        residente,
        op,
        (i) => i < INTENTOS_DRENAJE,
      );
      if (resultado === true) {
        aplicar(op);
        r.drenadas += 1;
      } else if (resultado === false) {
        r.inesperados.push({
          operacion: describir(op),
          status: 0,
          cuerpo: `sin confirmar tras ${INTENTOS_DRENAJE} intentos con la red estable`,
        });
      }
    }),
  );
  return r;
}
