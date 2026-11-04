import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  activarNotificaciones,
  desactivarNotificaciones,
  type ResultadoActivar,
} from '../aplicacion/notificaciones';
import { claves } from '../datos/consultas';
import { usePuertos } from '../datos/contexto';

/**
 * Activar y desactivar las notificaciones de este dispositivo, con su estado de carga y error. Lo
 * comparten la oferta tras un reporte y la sección de Cuenta.
 */
export function useActivarNotificaciones() {
  const puertos = usePuertos();
  const cliente = useQueryClient();
  const [ocupado, setOcupado] = useState(false);
  const [resultado, setResultado] = useState<ResultadoActivar | null>(null);
  const [error, setError] = useState(false);

  const refrescar = () => cliente.invalidateQueries({ queryKey: claves.suscripcionPush });

  async function activar(): Promise<ResultadoActivar | null> {
    setOcupado(true);
    setError(false);
    try {
      const r = await activarNotificaciones(puertos);
      setResultado(r);
      return r;
    } catch {
      setError(true);
      return null;
    } finally {
      setOcupado(false);
      await refrescar();
    }
  }

  async function desactivar(): Promise<void> {
    setOcupado(true);
    setError(false);
    try {
      await desactivarNotificaciones(puertos);
      setResultado(null);
    } catch {
      setError(true);
    } finally {
      setOcupado(false);
      await refrescar();
    }
  }

  return { activar, desactivar, ocupado, resultado, error };
}
