import type { EstadoSectorFila } from '@blackout/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { crearEstadosSectorSupabase } from './estados-sector.supabase';

type Callback = (cambio: { eventType: string; new: unknown }) => void;

/**
 * Imita a realtime-js 2.x en lo que importa aquí: `channel(nombre)` devuelve el canal existente si
 * el nombre se repite, `.on()` después de `subscribe()` lanza, y `removeChannel` es asíncrono (el
 * canal sigue registrado hasta que resuelve).
 */
function clienteFalso() {
  const canales = new Map<string, { suscrito: boolean; callbacks: Callback[] }>();
  const cliente = {
    channel(nombre: string) {
      const canal = canales.get(nombre) ?? { suscrito: false, callbacks: [] };
      canales.set(nombre, canal);
      const api = {
        nombre,
        on(_tipo: string, _filtro: unknown, callback: Callback) {
          if (canal.suscrito)
            throw new Error(`cannot add callbacks for ${nombre} after subscribe()`);
          canal.callbacks.push(callback);
          return api;
        },
        subscribe() {
          canal.suscrito = true;
          return api;
        },
      };
      return api;
    },
    async removeChannel({ nombre }: { nombre: string }) {
      await Promise.resolve();
      canales.delete(nombre);
      return 'ok';
    },
  };
  const emitir = (fila: object) => {
    for (const { callbacks } of canales.values()) {
      for (const callback of callbacks) callback({ eventType: 'UPDATE', new: fila });
    }
  };
  return { cliente: cliente as unknown as SupabaseClient, canales, emitir };
}

const FILA: EstadoSectorFila = {
  sector_id: 2,
  tipo_servicio: 'electricidad',
  estado: 'sin_servicio',
  reportes_sin_confirmar: 0,
  evento_id: 1,
  desde: '2026-10-07T19:05:00Z',
  actualizado_en: '2026-10-07T19:06:00Z',
};

describe('estados del sector por Supabase Realtime', () => {
  it('VIS-03: varios suscriptores a la vez comparten un canal y reciben cada cambio', () => {
    const { cliente, canales, emitir } = clienteFalso();
    const estados = crearEstadosSectorSupabase(cliente);
    const a: string[] = [];
    const b: string[] = [];
    estados.suscribir((f) => a.push(`${f.sectorId}/${f.estado}`));
    estados.suscribir((f) => b.push(`${f.sectorId}/${f.estado}`));
    expect(canales.size).toBe(1);
    emitir(FILA);
    expect(a).toEqual(['2/sin_servicio']);
    expect(b).toEqual(['2/sin_servicio']);
  });

  it('cierra el canal con el último oyente y reabre sin chocar con el que se está cerrando', () => {
    const { cliente, emitir } = clienteFalso();
    const estados = crearEstadosSectorSupabase(cliente);
    const recibidos: string[] = [];
    // Lo que hace StrictMode: monta, desmonta y vuelve a montar antes de que `removeChannel` acabe.
    const baja = estados.suscribir(() => recibidos.push('primero'));
    baja();
    baja();
    estados.suscribir(() => recibidos.push('segundo'));
    emitir(FILA);
    expect(recibidos).toEqual(['segundo']);
  });
});
