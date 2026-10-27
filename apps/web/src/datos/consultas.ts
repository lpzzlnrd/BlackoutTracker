import { CodigoError, type SectorAsignadoDto, type TipoServicio } from '@blackout/shared';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { ErrorApiCliente } from '../dominio/errores';
import type { EstadoSector, UsuarioSesion } from '../dominio/tipos';
import { useObservable, usePuertos } from './contexto';

// Las consultas de toda la app. Las pantallas leen datos solo con estos hooks: así la caché, las
// claves y lo que se invalida con cada cambio viven en un sitio.

export const claves = {
  sectores: ['sectores'] as const,
  estados: ['estados-sector'] as const,
  cola: ['cola-avisos'] as const,
  configuracion: ['configuracion'] as const,
  perfil: (usuarioId: string | undefined) => ['perfil', usuarioId] as const,
  misReportes: (usuarioId: string | undefined) => ['mis-reportes', usuarioId] as const,
  resumen: (sectorId: number) => ['resumen', sectorId] as const,
  estimacion: (sectorId: number, servicio: TipoServicio) =>
    ['estimacion', sectorId, servicio] as const,
  historial: (sectorId: number, servicio: TipoServicio | undefined) =>
    ['historial', sectorId, servicio ?? 'todos'] as const,
};

/** `GET /sectores`: casi nunca cambia, así que no se vuelve a pedir por su cuenta. */
export function useSectores() {
  const { sectores } = usePuertos();
  return useQuery({
    queryKey: claves.sectores,
    queryFn: () => sectores.obtenerGeoJson(),
    staleTime: Infinity,
  });
}

/**
 * Estado de todos los sectores: la instantánea inicial y, encima, los cambios que llegan por
 * Realtime, que se escriben directo en la caché (VIS-03). Un cambio de estado vuelve viejos el
 * resumen y la estimación de ese sector (un corte que se cierra mueve la mediana, EST-06).
 */
export function useEstadosSector() {
  const { estadosSector } = usePuertos();
  const cliente = useQueryClient();

  useEffect(
    () =>
      estadosSector.suscribir((fila) => {
        cliente.setQueryData<EstadoSector[]>(claves.estados, (actuales = []) => [
          ...actuales.filter(
            (f) => !(f.sectorId === fila.sectorId && f.tipoServicio === fila.tipoServicio),
          ),
          fila,
        ]);
        void cliente.invalidateQueries({ queryKey: claves.resumen(fila.sectorId) });
        void cliente.invalidateQueries({ queryKey: ['estimacion', fila.sectorId] });
        void cliente.invalidateQueries({ queryKey: ['historial', fila.sectorId] });
      }),
    [estadosSector, cliente],
  );

  return useQuery({ queryKey: claves.estados, queryFn: () => estadosSector.leerTodos() });
}

/** Avisos de la cola; se refresca solo cuando la cola avisa de un cambio. */
export function useColaAvisos() {
  const { colaAvisos } = usePuertos();
  const cliente = useQueryClient();

  useEffect(
    () => colaAvisos.suscribir(() => void cliente.invalidateQueries({ queryKey: claves.cola })),
    [colaAvisos, cliente],
  );

  return useQuery({ queryKey: claves.cola, queryFn: () => colaAvisos.listar() });
}

/** Umbrales del consenso y de la estimación ("2 de 3 reportes", "3 de 5 cortes"). */
export function useConfiguracion() {
  const { configuracion } = usePuertos();
  return useQuery({
    queryKey: claves.configuracion,
    queryFn: () => configuracion.obtener(),
    staleTime: Infinity,
  });
}

/** El usuario de Auth, o `null` sin sesión. Mirar la app no la necesita (D-029); reportar, sí. */
export function useSesion(): UsuarioSesion | null {
  const { sesion } = usePuertos();
  return useObservable(sesion);
}

/**
 * El sector del residente (`GET /residentes/me`). `null` si hay cuenta pero falta el pin (403
 * `REGISTRO_INCOMPLETO`, D-014) o si no hay sesión. Nunca trae coordenadas (NF-06).
 */
export function usePerfil() {
  const { residente } = usePuertos();
  const usuario = useSesion();
  return useQuery({
    queryKey: claves.perfil(usuario?.id),
    enabled: usuario !== null,
    staleTime: Infinity,
    retry: reintentarSiNoEsDefinitivo,
    queryFn: async (): Promise<SectorAsignadoDto | null> => {
      try {
        return await residente.obtenerMio();
      } catch (error) {
        if (error instanceof ErrorApiCliente && error.codigo === CodigoError.RegistroIncompleto) {
          return null;
        }
        throw error;
      }
    },
  });
}

/** Mis reportes (`GET /reportes/mios`): de aquí sale si tengo un corte abierto por servicio. */
export function useMisReportes() {
  const { reportes } = usePuertos();
  const usuario = useSesion();
  const perfil = usePerfil();
  return useQuery({
    queryKey: claves.misReportes(usuario?.id),
    enabled: usuario !== null && Boolean(perfil.data),
    retry: reintentarSiNoEsDefinitivo,
    queryFn: () => reportes.obtenerMios({ abiertos: true }),
  });
}

/** `GET /sectores/:id/resumen`: estado, estimación y últimos cortes de los dos servicios (VIS-04). */
export function useResumen(sectorId: number | undefined) {
  const { detalleSector } = usePuertos();
  return useQuery({
    queryKey: claves.resumen(sectorId ?? -1),
    enabled: sectorId !== undefined,
    retry: reintentarSiNoEsDefinitivo,
    queryFn: () => detalleSector.resumen(sectorId as number),
  });
}

/** `GET /estimaciones` de un sector y servicio (EST). */
export function useEstimacion(sectorId: number | undefined, servicio: TipoServicio) {
  const { estimaciones } = usePuertos();
  return useQuery({
    queryKey: claves.estimacion(sectorId ?? -1, servicio),
    enabled: sectorId !== undefined,
    retry: reintentarSiNoEsDefinitivo,
    queryFn: () => estimaciones.obtener(sectorId as number, servicio),
  });
}

/** `GET /sectores/:id/historial`, paginado por cursor ("Ver más"). Solo cortes cerrados. */
export function useHistorial(sectorId: number | undefined, servicio?: TipoServicio) {
  const { detalleSector } = usePuertos();
  return useInfiniteQuery({
    queryKey: claves.historial(sectorId ?? -1, servicio),
    enabled: sectorId !== undefined,
    retry: reintentarSiNoEsDefinitivo,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      detalleSector.historial(sectorId as number, { tipoServicio: servicio, cursor: pageParam }),
    getNextPageParam: (pagina) => pagina.siguienteCursor ?? undefined,
  });
}

/** 4xx: reintentar no cambia la respuesta. */
const esDefinitivo = (error: unknown): boolean =>
  error instanceof ErrorApiCliente && error.estado >= 400 && error.estado < 500;

/** Un 404 de un sector inexistente se muestra al momento; la red caída sí se reintenta. */
function reintentarSiNoEsDefinitivo(intentos: number, error: unknown): boolean {
  return !esDefinitivo(error) && intentos < 2;
}
