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
  const sw = navigator.serviceWorker;

  let recargando = false;
  const recargar = () => {
    if (recargando) return;
    recargando = true;
    location.reload();
  };

  const activarVersion = registerSW({
    // Una página sin service worker que la controle (Ctrl+Shift+R) viene de la red y ya trae el
    // código nuevo: ofrecerle "Actualizar" sería mentirle.
    onNeedRefresh: () => {
      if (sw.controller) versionNueva.fijar(true);
    },
    onNeedReload: recargar,
  });

  // Cuando la versión nueva toma el control, esta página sigue con el código viejo y hay que
  // recargarla. `vite-plugin-pwa` solo lo hace si la página arrancó con un service worker
  // (`isUpdate` de workbox-window): si arrancó sin él (la primera visita), el aviso se quedaba
  // pegado y el botón no hacía nada. Sin versión ofrecida no se recarga: es el primer SW que
  // toma el control (`clientsClaim`).
  sw.addEventListener('controllerchange', () => {
    if (versionNueva.leer()) recargar();
  });

  return {
    versionNueva: { leer: versionNueva.leer, suscribir: versionNueva.suscribir },
    async actualizar() {
      const registro = await sw.getRegistration();
      // Si ya no hay nada esperando (otra pestaña la activó), basta con recargar.
      if (registro?.waiting) await activarVersion(true);
      else recargar();
    },
  };
}
