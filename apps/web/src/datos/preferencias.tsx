import { TipoServicio } from '@blackout/shared';
import { createContext, useContext, useState, type ReactNode } from 'react';

// Preferencias del vecino que comparten varias pantallas (el servicio que mira en el mapa y en el
// panel). Se recuerdan en `localStorage`, que puede no existir (modo privado): por eso el try.

const CLAVE_SERVICIO = 'servicio';

const leerServicio = (): TipoServicio => {
  try {
    const guardado = localStorage.getItem(CLAVE_SERVICIO);
    if (guardado === TipoServicio.Agua || guardado === TipoServicio.Electricidad) return guardado;
  } catch {
    // sin almacenamiento: se usa el valor por defecto
  }
  return TipoServicio.Electricidad;
};

type ContextoServicio = readonly [TipoServicio, (servicio: TipoServicio) => void];

const Contexto = createContext<ContextoServicio | null>(null);

export function PreferenciasProvider({ children }: { children: ReactNode }) {
  const [servicio, fijar] = useState(leerServicio);
  const elegir = (nuevo: TipoServicio) => {
    fijar(nuevo);
    try {
      localStorage.setItem(CLAVE_SERVICIO, nuevo);
    } catch {
      // sin almacenamiento: se recuerda solo mientras la pestaña siga abierta
    }
  };
  return <Contexto value={[servicio, elegir]}>{children}</Contexto>;
}

/** El servicio elegido (Luz / Agua) y cómo cambiarlo. Lo comparten el mapa y el panel. */
export function useServicio(): ContextoServicio {
  const valor = useContext(Contexto);
  if (!valor) throw new Error('useServicio fuera de <PreferenciasProvider>.');
  return valor;
}
