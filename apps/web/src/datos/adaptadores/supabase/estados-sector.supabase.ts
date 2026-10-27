import type { EstadoSectorFila } from '@blackout/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { desdeFila } from '../../../dominio/estado-sector';
import { ErrorApiCliente } from '../../../dominio/errores';
import type { EstadosSector } from '../../puertos';

/**
 * `estado_sector` directo de Supabase: instantánea por REST y cambios por Realtime
 * (`postgres_changes`). Es lo único que el front lee sin pasar por Nest, y por eso la tabla es
 * lo único con una política de lectura en RLS (T-011).
 */
export function crearEstadosSectorSupabase(supabase: SupabaseClient): EstadosSector {
  return {
    async leerTodos() {
      const { data, error, status } = await supabase.from('estado_sector').select('*');
      // `status` es 0 cuando `fetch` ni siquiera obtuvo respuesta.
      if (error) throw new ErrorApiCliente(status);
      return (data as EstadoSectorFila[]).map(desdeFila);
    },
    suscribir(alCambiar) {
      const canal = supabase
        .channel('estado_sector')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'estado_sector' },
          (cambio) => {
            if (cambio.eventType !== 'DELETE') alCambiar(desdeFila(cambio.new as EstadoSectorFila));
          },
        )
        .subscribe();
      return () => {
        void supabase.removeChannel(canal);
      };
    },
  };
}
