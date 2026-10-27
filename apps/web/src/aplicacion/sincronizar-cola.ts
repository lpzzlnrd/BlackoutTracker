import { ErrorApiCliente, resolverFallo } from '../dominio/errores';
import type { AvisoCola } from '../dominio/tipos';
import type { Puertos } from '../datos/puertos';

export type DependenciasSincronizacion = Pick<
  Puertos,
  'colaAvisos' | 'reportes' | 'conexion' | 'reloj' | 'sesion'
>;

export interface ResultadoSincronizacion {
  enviados: number;
  /** Avisos que el servidor rechazó para siempre (400, 409, 422): quedan en `error`. */
  rechazados: number;
  /** Por qué se detuvo antes de vaciar la cola; ausente si se procesó todo. */
  detenidoPor?: 'red' | 'servidor' | 'limite' | 'sesion' | 'inicio-pendiente';
}

async function enviar(aviso: AvisoCola, { reportes }: DependenciasSincronizacion): Promise<void> {
  if (aviso.accion === 'inicio') {
    await reportes.iniciar(aviso.reporteId, {
      tipoServicio: aviso.tipoServicio,
      ocurridoEn: aviso.ocurridoEn,
    });
  } else {
    await reportes.cerrar(aviso.reporteId, { ocurridoEn: aviso.ocurridoEn });
  }
}

/**
 * Envía los avisos pendientes de uno en uno y por orden cronológico (OFF-04, PWA.md §7). Se
 * detiene en el primer fallo reintentable para no desordenar; un rechazo permanente se marca
 * `error` y sigue con el resto. Es seguro repetirla: el servidor es idempotente por `reporteId`
 * (OFF-05), así que un corte a mitad de envío nunca duplica nada.
 */
export async function sincronizarCola(
  deps: DependenciasSincronizacion,
): Promise<ResultadoSincronizacion> {
  const { colaAvisos, conexion, reloj, sesion } = deps;
  const resultado: ResultadoSincronizacion = { enviados: 0, rechazados: 0 };
  const pendientes = (await colaAvisos.listar()).filter((a) => a.estado === 'pendiente');

  for (const aviso of pendientes) {
    let renovada = false;
    for (;;) {
      try {
        await enviar(aviso, deps);
        await colaAvisos.marcarEnviado(aviso.id);
        conexion.registrarExito(reloj.ahora());
        resultado.enviados += 1;
        break;
      } catch (error) {
        if (!(error instanceof ErrorApiCliente)) throw error;
        const que = resolverFallo(error, aviso.accion);

        if (que === 'permanente') {
          await colaAvisos.marcarError(aviso.id, error.codigo);
          resultado.rechazados += 1;
          break;
        }
        if (que === 'renovar-sesion') {
          // Un segundo 401 con la sesión ya renovada: hace falta que el vecino vuelva a entrar.
          if (renovada || !(await sesion.token())) {
            resultado.detenidoPor = 'sesion';
            return resultado;
          }
          renovada = true;
          continue;
        }
        // Reintentable: red caída, 5xx, 429 o el 404 de un cierre cuyo inicio aún no llega.
        if (error.estado === 0) conexion.registrarFallo('red');
        else if (error.estado >= 500) conexion.registrarFallo('servidor');
        resultado.detenidoPor =
          error.estado === 0
            ? 'red'
            : error.estado >= 500
              ? 'servidor'
              : error.estado === 429
                ? 'limite'
                : 'inicio-pendiente';
        return resultado;
      }
    }
  }
  return resultado;
}

/**
 * Envuelve `sincronizarCola` para que dos disparos a la vez (evento `online` y apertura de la
 * app, por ejemplo) compartan una sola pasada en vez de enviar en paralelo y desordenar.
 */
export function crearSincronizador(
  deps: DependenciasSincronizacion,
): () => Promise<ResultadoSincronizacion> {
  let enCurso: Promise<ResultadoSincronizacion> | null = null;
  return () => {
    enCurso ??= sincronizarCola(deps).finally(() => {
      enCurso = null;
    });
    return enCurso;
  };
}
