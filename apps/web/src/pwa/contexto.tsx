import { createContext, useContext, type ReactNode } from 'react';
import type { Instalacion } from './instalacion';
import type { ServiceWorkerApp } from './registro';

/** Lo que la interfaz necesita de la PWA. `sw` es nulo en desarrollo y en la demo (sin SW). */
export interface Pwa {
  sw: ServiceWorkerApp | null;
  instalacion: Instalacion;
}

const Contexto = createContext<Pwa | null>(null);

export function PwaProvider({ pwa, children }: { pwa: Pwa; children: ReactNode }) {
  return <Contexto value={pwa}>{children}</Contexto>;
}

export function usePwa(): Pwa {
  const pwa = useContext(Contexto);
  if (!pwa) throw new Error('usePwa fuera de <PwaProvider>.');
  return pwa;
}
