import { createClient } from '@supabase/supabase-js';
import type { EscenarioDemo } from './adaptadores/mock/escenario';
import { crearColaAvisosDexie } from './adaptadores/dexie/cola-avisos.dexie';
import {
  crearRepositorioDetalleSectorHttp,
  crearRepositorioEstimacionesHttp,
  crearRepositorioReportesHttp,
  crearRepositorioResidenteHttp,
  crearRepositorioSectoresHttp,
  crearSondaSaludHttp,
} from './adaptadores/http/api.http';
import { crearClienteHttp } from './adaptadores/http/cliente';
import { crearConexionNavegador } from './adaptadores/navegador/conexion.navegador';
import { configuracionEstatica } from './adaptadores/navegador/configuracion.estatica';
import { relojSistema } from './adaptadores/navegador/reloj.sistema';
import { crearEstadosSectorSupabase } from './adaptadores/supabase/estados-sector.supabase';
import { crearSesionSupabase } from './adaptadores/supabase/sesion.supabase';
import type { Puertos } from './puertos';

export type ModoApp = { tipo: 'real' } | { tipo: 'demo'; escenario: EscenarioDemo };

/** `?demo=en-linea` y `?demo=sin-conexion` activan la demostración (CANON §11); lo demás, la app real. */
export function leerModo(search: string): ModoApp {
  const demo = new URLSearchParams(search).get('demo');
  return demo === 'en-linea' || demo === 'sin-conexion'
    ? { tipo: 'demo', escenario: demo }
    : { tipo: 'real' };
}

/** Los adaptadores de verdad: la API de Nest, Dexie y Supabase (solo Auth y Realtime). */
export function componerPuertosReales(): Puertos {
  const urlSupabase = import.meta.env.VITE_SUPABASE_URL;
  const claveSupabase = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!urlSupabase || !claveSupabase) {
    throw new Error(
      'Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (ver el .env.example de la raíz). ' +
        'Para probar sin backend, abre la app con /?demo=en-linea.',
    );
  }
  const baseUrl = import.meta.env.VITE_API_URL ?? '/api';

  const supabase = createClient(urlSupabase, claveSupabase);
  const reloj = relojSistema;
  const conexion = crearConexionNavegador({});
  const sesion = crearSesionSupabase(supabase);
  const http = crearClienteHttp({ baseUrl, sesion, conexion, reloj });

  return {
    reloj,
    conexion,
    sondaSalud: crearSondaSaludHttp(baseUrl),
    configuracion: configuracionEstatica,
    sesion,
    sectores: crearRepositorioSectoresHttp(http),
    residente: crearRepositorioResidenteHttp(http),
    reportes: crearRepositorioReportesHttp(http),
    estimaciones: crearRepositorioEstimacionesHttp(http),
    detalleSector: crearRepositorioDetalleSectorHttp(http),
    estadosSector: crearEstadosSectorSupabase(supabase),
    colaAvisos: crearColaAvisosDexie(),
  };
}

/**
 * Único lugar que decide qué adaptadores se usan. La demo se importa de forma dinámica: sus
 * mocks y el JSON de ejemplo van en un chunk aparte que solo baja quien abre `?demo=`.
 */
export async function componerPuertos(modo: ModoApp): Promise<Puertos> {
  if (modo.tipo === 'real') return componerPuertosReales();
  const { cargarPuertosDemo } = await import('./adaptadores/mock/cargar');
  return cargarPuertosDemo({ escenario: modo.escenario });
}
