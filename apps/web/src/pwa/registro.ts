import { registerSW } from 'virtual:pwa-register';
import { crearAlmacen, type Observable } from '../dominio/observable';

export interface ServiceWorkerApp {
  /** `true` cuando hay una versión nueva esperando: la interfaz ofrece "Actualizar". */
  versionNueva: Observable<boolean>;
  /** Activa la versión nueva y recarga la página. */
  actualizar(): Promise<void>;
}

export function registrarServiceWorker(): ServiceWorkerApp {
  const versionNueva = crearAlmacen(false);
  const actualizarSW = registerSW({ onNeedRefresh: () => versionNueva.fijar(true) });
  return {
    versionNueva: { leer: versionNueva.leer, suscribir: versionNueva.suscribir },
    actualizar: () => actualizarSW(true),
  };
}
