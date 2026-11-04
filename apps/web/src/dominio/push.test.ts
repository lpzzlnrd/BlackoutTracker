import { describe, expect, it } from 'vitest';
import { aSolicitud, claveABytes, esIOS, esIdNotificacion, estadoPush, mismaClave } from './push';

describe('estadoPush (T-072)', () => {
  it('NOT-18: traduce el permiso del navegador', () => {
    const base = { soportaPush: true, ios: false, instalada: false };
    expect(estadoPush({ ...base, permiso: 'default' })).toBe('pendiente');
    expect(estadoPush({ ...base, permiso: 'granted' })).toBe('concedido');
    expect(estadoPush({ ...base, permiso: 'denied' })).toBe('denegado');
  });

  it('NOT-20: un iPhone sin la app instalada no tiene push y hay que decirle que la instale', () => {
    expect(
      estadoPush({ soportaPush: false, permiso: 'default', ios: true, instalada: false }),
    ).toBe('requiere-instalar');
    expect(estadoPush({ soportaPush: false, permiso: 'default', ios: true, instalada: true })).toBe(
      'no-soportado',
    );
    expect(
      estadoPush({ soportaPush: false, permiso: 'default', ios: false, instalada: false }),
    ).toBe('no-soportado');
  });

  it('NOT-20: reconoce iPhone y el iPad que se presenta como Mac', () => {
    const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15';
    expect(esIOS({ userAgent: iphone, platform: 'iPhone', maxTouchPoints: 5 })).toBe(true);
    expect(esIOS({ userAgent: 'Macintosh', platform: 'MacIntel', maxTouchPoints: 5 })).toBe(true);
    expect(esIOS({ userAgent: 'Macintosh', platform: 'MacIntel', maxTouchPoints: 0 })).toBe(false);
    expect(esIOS({ userAgent: 'Android 14', platform: 'Linux armv8l', maxTouchPoints: 5 })).toBe(
      false,
    );
  });
});

describe('claves y suscripciones (T-072)', () => {
  // Una clave pública VAPID real: 65 bytes (punto P-256 sin comprimir) en base64url.
  const CLAVE =
    'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

  it('NOT-19: convierte la clave pública base64url en los 65 bytes que pide subscribe', () => {
    const bytes = claveABytes(CLAVE);
    expect(bytes).toHaveLength(65);
    expect(bytes[0]).toBe(0x04); // punto sin comprimir
  });

  it('NOT-19: detecta si la suscripción existente se hizo con otra clave', () => {
    const bytes = claveABytes(CLAVE);
    expect(mismaClave(bytes.slice().buffer, bytes)).toBe(true);
    const otra = bytes.slice();
    otra[10] ^= 1;
    expect(mismaClave(otra.buffer, bytes)).toBe(false);
    expect(mismaClave(null, bytes)).toBe(false);
  });

  it('NOT-19: PushSubscription.toJSON() pasa al cuerpo de la API, y sin claves no hay suscripción', () => {
    expect(
      aSolicitud({
        endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
        keys: { p256dh: 'p', auth: 'a' },
      }),
    ).toEqual({
      endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
      claves: { p256dh: 'p', auth: 'a' },
    });
    expect(aSolicitud({ endpoint: 'https://fcm.googleapis.com/x', keys: {} })).toBeNull();
    expect(aSolicitud({ keys: { p256dh: 'p', auth: 'a' } })).toBeNull();
  });

  it('NOT-16: el ?n= de una notificación abierta solo acepta un UUID', () => {
    expect(esIdNotificacion('5f0c6a2e-9b1d-4c3e-8a7f-1e2d3c4b5a69')).toBe(true);
    expect(esIdNotificacion('1; drop table')).toBe(false);
    expect(esIdNotificacion(null)).toBe(false);
  });
});
