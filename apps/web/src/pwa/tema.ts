// Tema claro u oscuro (PWA.md §6). Por defecto sigue al sistema; el vecino puede fijarlo en Cuenta.
// `index.html` aplica lo guardado antes de pintar, para que no haya destello.

export type Tema = 'sistema' | 'claro' | 'oscuro';

const CLAVE = 'tema';
const consultaOscuro = () => matchMedia('(prefers-color-scheme: dark)');

export function leerTema(): Tema {
  try {
    const guardado = localStorage.getItem(CLAVE);
    if (guardado === 'claro' || guardado === 'oscuro') return guardado;
  } catch {
    // sin almacenamiento: sistema
  }
  return 'sistema';
}

/** Aplica el tema a `<html>` y al `theme-color` de la barra del navegador, y lo recuerda. */
export function aplicarTema(tema: Tema): void {
  try {
    if (tema === 'sistema') localStorage.removeItem(CLAVE);
    else localStorage.setItem(CLAVE, tema);
  } catch {
    // sin almacenamiento: dura lo que dure la pestaña
  }
  const oscuro = tema === 'sistema' ? consultaOscuro().matches : tema === 'oscuro';
  document.documentElement.classList.toggle('dark', oscuro);
  const fondo = getComputedStyle(document.documentElement).getPropertyValue('--fondo').trim();
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    if (tema === 'sistema') {
      meta.content = meta.media.includes('dark') ? '#0b1220' : '#f8fafc';
    } else if (fondo) {
      meta.content = fondo;
    }
  }
}

/** Con el tema del sistema, sigue sus cambios (p. ej. el modo noche automático del teléfono). */
export function seguirSistema(): void {
  consultaOscuro().addEventListener('change', () => {
    if (leerTema() === 'sistema') aplicarTema('sistema');
  });
}
