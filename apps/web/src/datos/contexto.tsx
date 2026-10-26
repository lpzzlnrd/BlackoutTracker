import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import type { Observable } from '../dominio/observable';
import type { Puertos } from './puertos';

const ContextoPuertos = createContext<Puertos | null>(null);

export function PuertosProvider({ puertos, children }: { puertos: Puertos; children: ReactNode }) {
  return <ContextoPuertos value={puertos}>{children}</ContextoPuertos>;
}

/** Los puertos de la app. Lo único que la interfaz conoce del mundo exterior. */
export function usePuertos(): Puertos {
  const puertos = useContext(ContextoPuertos);
  if (!puertos) throw new Error('usePuertos fuera de <PuertosProvider>.');
  return puertos;
}

/** Engancha cualquier `Observable` de un puerto (conexión, sesión) a React sin librerías. */
export function useObservable<T>(observable: Observable<T>): T {
  return useSyncExternalStore(observable.suscribir, observable.leer);
}
