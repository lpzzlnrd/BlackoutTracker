import type { ErrorApi } from '@blackout/shared';
import { ErrorApiCliente } from '../../../dominio/errores';
import type { Conexion, Reloj, Sesion } from '../../puertos';

type Consulta = Record<string, string | number | boolean | undefined>;

export interface OpcionesPeticion {
  cuerpo?: unknown;
  consulta?: Consulta;
  /** Rutas públicas (`/sectores`, `/registro/validar-pin`) van sin token. */
  conSesion?: boolean;
}

export interface ClienteHttp {
  pedir<T>(
    metodo: 'GET' | 'POST' | 'PUT' | 'PATCH',
    ruta: string,
    opciones?: OpcionesPeticion,
  ): Promise<T>;
}

const TIEMPO_MAXIMO_MS = 10_000;

/**
 * Cliente de la API de Nest. Convierte todo fallo en `ErrorApiCliente` (0 si no hubo respuesta) y
 * le cuenta a `Conexion` si el servidor contestó: es lo que hace que la franja "sin conexión"
 * dependa de las peticiones reales y no solo de `navigator.onLine` (PWA.md §7).
 */
export function crearClienteHttp(dependencias: {
  baseUrl: string;
  sesion: Sesion;
  conexion: Conexion;
  reloj: Reloj;
  fetchImpl?: typeof fetch;
}): ClienteHttp {
  const { baseUrl, sesion, conexion, reloj } = dependencias;
  const peticion = dependencias.fetchImpl ?? ((...args) => fetch(...args));

  const url = (ruta: string, consulta?: Consulta): string => {
    const params = new URLSearchParams();
    for (const [clave, valor] of Object.entries(consulta ?? {})) {
      if (valor !== undefined) params.set(clave, String(valor));
    }
    const texto = params.toString();
    return `${baseUrl.replace(/\/$/, '')}${ruta}${texto ? `?${texto}` : ''}`;
  };

  async function pedir<T>(
    metodo: 'GET' | 'POST' | 'PUT' | 'PATCH',
    ruta: string,
    { cuerpo, consulta, conSesion = true }: OpcionesPeticion = {},
  ): Promise<T> {
    const cabeceras: Record<string, string> = { Accept: 'application/json' };
    if (cuerpo !== undefined) cabeceras['Content-Type'] = 'application/json';
    if (conSesion) {
      const token = await sesion.token();
      if (token) cabeceras.Authorization = `Bearer ${token}`;
    }

    let respuesta: Response;
    try {
      respuesta = await peticion(url(ruta, consulta), {
        method: metodo,
        headers: cabeceras,
        body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
        signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
      });
    } catch {
      conexion.registrarFallo('red');
      throw new ErrorApiCliente(0);
    }

    if (respuesta.status >= 500) conexion.registrarFallo('servidor');
    else conexion.registrarExito(reloj.ahora());

    if (!respuesta.ok) {
      const error = (await respuesta.json().catch(() => null)) as Partial<ErrorApi> | null;
      throw new ErrorApiCliente(respuesta.status, error?.codigo);
    }
    return (await respuesta.json()) as T;
  }

  return { pedir };
}
