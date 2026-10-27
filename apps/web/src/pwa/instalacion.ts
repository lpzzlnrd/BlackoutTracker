import { crearAlmacen, type Observable } from '../dominio/observable';

// "Instalar BlackoutTracker" (A §4): solo si el navegador lo permite (Chrome y Edge disparan
// `beforeinstallprompt`; Safari no, allí se instala desde "Compartir") y si el vecino no lo descartó.

interface EventoInstalacion extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface Instalacion {
  /** `true` si se puede ofrecer la instalación ahora mismo. */
  disponible: Observable<boolean>;
  instalar(): Promise<void>;
  /** "Ahora no": no se vuelve a ofrecer en este navegador. */
  descartar(): void;
}

const CLAVE_DESCARTE = 'instalacion-descartada';

const descartadaAntes = (): boolean => {
  try {
    return localStorage.getItem(CLAVE_DESCARTE) === '1';
  } catch {
    return false;
  }
};

export function crearInstalacion(): Instalacion {
  const disponible = crearAlmacen(false);
  let evento: EventoInstalacion | null = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // la ofrecemos nosotros, cuando toca
    evento = e as EventoInstalacion;
    if (!descartadaAntes()) disponible.fijar(true);
  });
  window.addEventListener('appinstalled', () => {
    evento = null;
    disponible.fijar(false);
  });

  return {
    disponible: { leer: disponible.leer, suscribir: disponible.suscribir },
    async instalar() {
      if (!evento) return;
      await evento.prompt();
      await evento.userChoice;
      evento = null;
      disponible.fijar(false);
    },
    descartar() {
      disponible.fijar(false);
      try {
        localStorage.setItem(CLAVE_DESCARTE, '1');
      } catch {
        // sin almacenamiento: se vuelve a ofrecer la próxima vez
      }
    },
  };
}
