import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { claves, useColaAvisos, useSesion } from '../datos/consultas';

/**
 * Cada aviso que el servidor acepta o rechaza (desde Reportar, desde Avisos o desde
 * `vigilarConexion` al volver la red) cambia "mis reportes" y quizá el estado del sector: se
 * vuelven a pedir.
 */
export function useRefrescarTrasEnvio(): void {
  const cliente = useQueryClient();
  const usuario = useSesion();
  const cola = useColaAvisos();

  const resueltos = cola.data?.filter((a) => a.estado !== 'pendiente').length ?? 0;
  const previos = useRef(resueltos);
  useEffect(() => {
    if (resueltos === previos.current) return;
    previos.current = resueltos;
    void cliente.invalidateQueries({ queryKey: claves.misReportes(usuario?.id) });
    void cliente.invalidateQueries({ queryKey: claves.estados });
  }, [resueltos, cliente, usuario?.id]);
}
