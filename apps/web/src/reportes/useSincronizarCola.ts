import { useCallback } from 'react';
import { useSincronizar } from '../datos/contexto';

/** Pide un envío de la cola ahora (al encolar y al reintentar). Nunca lanza. */
export function useSincronizarCola(): () => Promise<void> {
  const sincronizar = useSincronizar();
  return useCallback(async () => {
    await sincronizar().catch(() => undefined);
  }, [sincronizar]);
}
