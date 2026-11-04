import type { NotificacionPushDto } from '@blackout/shared';
import { describe, expect, it } from 'vitest';
import {
  ICONO,
  INSIGNIA,
  VIBRACION,
  destinoDelClic,
  esMensajeNavegar,
  leerNotificacion,
  opcionesDeNotificacion,
} from './notificaciones-sw';

const ID = '5f0c6a2e-9b1d-4c3e-8a7f-1e2d3c4b5a69';

const corte: NotificacionPushDto = {
  id: ID,
  tipo: 'corte_confirmado',
  titulo: 'Se fue la luz en Guaparo',
  cuerpo: 'Desde las 14:20, lo confirmaron 3 vecinos.',
  etiqueta: 'corte-7-electricidad',
  url: `/?n=${ID}`,
  renotificar: true,
  tipoServicio: 'electricidad',
  imagen: null,
  acciones: [],
};

const pregunta: NotificacionPushDto = {
  ...corte,
  tipo: 'pregunta_vecinos',
  titulo: '¿Y el agua por tu casa?',
  etiqueta: 'corte-7-agua',
  url: `/reportar?servicio=agua&n=${ID}`,
  tipoServicio: 'agua',
  acciones: [
    { accion: 'se-fue', titulo: 'Se fue' },
    { accion: 'aqui-si-hay', titulo: 'Aquí sí hay' },
  ],
};

describe('leerNotificacion (T-072)', () => {
  it('NOT-21: acepta el cuerpo que envía la API', () => {
    expect(leerNotificacion(corte)).toEqual(corte);
    expect(leerNotificacion(pregunta)).toEqual(pregunta);
  });

  it('NOT-21: descarta lo que no entiende en vez de mostrar una notificación rota', () => {
    expect(leerNotificacion(null)).toBeNull();
    expect(leerNotificacion('hola')).toBeNull();
    expect(leerNotificacion({ ...corte, titulo: '' })).toBeNull();
    expect(leerNotificacion({ ...corte, tipo: 'otro' })).toBeNull();
  });

  it('NOT-22: solo abre rutas de la app (nunca otro dominio) y solo imágenes por HTTPS', () => {
    expect(leerNotificacion({ ...corte, url: 'https://otro.example/' })).toBeNull();
    expect(leerNotificacion({ ...corte, url: '//otro.example/' })).toBeNull();
    expect(leerNotificacion({ ...corte, imagen: 'http://x/y.png' })?.imagen).toBeNull();
    expect(leerNotificacion({ ...corte, imagen: 'https://api/x.png' })?.imagen).toBe(
      'https://api/x.png',
    );
  });

  it('NOT-21: ignora botones desconocidos', () => {
    const raro = { ...pregunta, acciones: [{ accion: 'borrar-todo', titulo: 'Sí' }] };
    expect(leerNotificacion(raro)?.acciones).toEqual([]);
  });
});

describe('opcionesDeNotificacion (T-072, D-042)', () => {
  it('NOT-21: una sola tarjeta por corte (tag del sector y servicio) que vuelve a sonar al cambiar', () => {
    const { titulo, opciones } = opcionesDeNotificacion(corte, 1000);
    expect(titulo).toBe('Se fue la luz en Guaparo');
    expect(opciones).toMatchObject({
      body: corte.cuerpo,
      tag: 'corte-7-electricidad',
      renotify: true,
      icon: ICONO,
      badge: INSIGNIA,
      timestamp: 1000,
      data: { id: ID, url: corte.url, tipoServicio: 'electricidad' },
    });
    expect(opciones.image).toBeUndefined();
  });

  it('NOT-21: la luz y el agua vibran distinto', () => {
    expect(opcionesDeNotificacion(corte, 0).opciones.vibrate).toEqual([...VIBRACION.electricidad]);
    expect(opcionesDeNotificacion(pregunta, 0).opciones.vibrate).toEqual([...VIBRACION.agua]);
    expect(VIBRACION.agua).not.toEqual(VIBRACION.electricidad);
  });

  it('NOT-21: la pregunta a los vecinos lleva sus dos botones, en el mismo orden', () => {
    expect(opcionesDeNotificacion(pregunta, 0).opciones.actions).toEqual([
      { action: 'se-fue', title: 'Se fue' },
      { action: 'aqui-si-hay', title: 'Aquí sí hay' },
    ]);
  });

  it('NOT-21: con imagen del hexágono, la muestra', () => {
    const conImagen = { ...corte, imagen: 'https://api.example/hex.png' };
    expect(opcionesDeNotificacion(conImagen, 0).opciones.image).toBe(conImagen.imagen);
  });
});

describe('destinoDelClic (T-072)', () => {
  const datos = opcionesDeNotificacion(pregunta, 0).opciones.data;

  it('NOT-22: «Se fue» abre Reportar con el aviso de inicio listo de ese servicio', () => {
    expect(destinoDelClic(datos, 'se-fue')).toBe(`/reportar?servicio=agua&accion=se-fue&n=${ID}`);
  });

  it('NOT-22: «Aquí sí hay» solo cierra la notificación', () => {
    expect(destinoDelClic(datos, 'aqui-si-hay')).toBeNull();
  });

  it('NOT-22: tocar la notificación abre su ruta; una ruta ajena lleva al mapa', () => {
    expect(destinoDelClic(datos, '')).toBe(pregunta.url);
    expect(destinoDelClic({ url: 'https://otro.example' }, '')).toBe('/');
    expect(destinoDelClic(undefined, '')).toBe('/');
  });

  it('NOT-22: el mensaje para navegar sin recargar solo acepta rutas de la app', () => {
    expect(esMensajeNavegar({ tipo: 'navegar', url: '/panel?n=1' })).toBe(true);
    expect(esMensajeNavegar({ tipo: 'navegar', url: 'https://otro.example' })).toBe(false);
    expect(esMensajeNavegar({ type: 'SKIP_WAITING' })).toBe(false);
  });
});
