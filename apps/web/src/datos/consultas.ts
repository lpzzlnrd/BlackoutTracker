import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { EstadoSector } from '../dominio/tipos';
import { usePuertos } from './contexto';

export const claves = {
  sectores: ['sectores'] as const,
  estados: ['estados-sector'] as const,
  cola: ['cola-avisos'] as const,
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
 * Realtime, que se escriben directo en la caché (VIS-03).
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
