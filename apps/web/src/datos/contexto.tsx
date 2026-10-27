import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import type { Observable } from '../dominio/observable';
import type { Puertos } from './puertos';

const ContextoPuertos = createContext<Puertos | null>(null);
const ContextoSincronizar = createContext<(() => Promise<unknown>) | null>(null);

/**
 * `sincronizar` es el mismo envío de la cola que usa `vigilarConexion`: compartirlo hace que un
 * aviso nuevo y la vuelta de la red no lancen dos pasadas a la vez.
 */
export function PuertosProvider({
  puertos,
  sincronizar,
  children,
}: {
  puertos: Puertos;
  sincronizar: () => Promise<unknown>;
  children: ReactNode;
}) {
  return (
    <ContextoPuertos value={puertos}>
      <ContextoSincronizar value={sincronizar}>{children}</ContextoSincronizar>
    </ContextoPuertos>
  );
}

/** Los puertos de la app. Lo único que la interfaz conoce del mundo exterior. */
export function usePuertos(): Puertos {
  const puertos = useContext(ContextoPuertos);
  if (!puertos) throw new Error('usePuertos fuera de <PuertosProvider>.');
  return puertos;
}

/** Pide un envío de la cola ahora (al encolar un aviso o al reintentarlo). */
export function useSincronizar(): () => Promise<unknown> {
  const sincronizar = useContext(ContextoSincronizar);
  if (!sincronizar) throw new Error('useSincronizar fuera de <PuertosProvider>.');
  return sincronizar;
}

/** Engancha cualquier `Observable` de un puerto (conexión, sesión) a React sin librerías. */
export function useObservable<T>(observable: Observable<T>): T {
  return useSyncExternalStore(observable.suscribir, observable.leer);
}
