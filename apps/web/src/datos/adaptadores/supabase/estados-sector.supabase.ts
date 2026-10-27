import type { EstadoSectorFila } from '@blackout/shared';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { desdeFila } from '../../../dominio/estado-sector';
import { ErrorApiCliente } from '../../../dominio/errores';
import { crearEmisor } from '../../../dominio/observable';
import type { EstadoSector } from '../../../dominio/tipos';
import type { EstadosSector } from '../../puertos';

/**
 * `estado_sector` directo de Supabase: instantánea por REST y cambios por Realtime
 * (`postgres_changes`). Es lo único que el front lee sin pasar por Nest, y por eso la tabla es
 * lo único con una política de lectura en RLS (T-011).
 *
 * Un solo canal para todos los suscriptores: varias pantallas usan `useEstadosSector` a la vez, y
 * `supabase.channel(nombre)` devuelve el canal ya suscrito si el nombre se repite, al que ya no se
 * le pueden añadir callbacks. Se abre con el primer oyente y se cierra con el último.
 */
export function crearEstadosSectorSupabase(supabase: SupabaseClient): EstadosSector {
  const cambios = crearEmisor<EstadoSector>();
  let oyentes = 0;
  let aperturas = 0;
  let canal: RealtimeChannel | null = null;

  return {
    async leerTodos() {
      const { data, error, status } = await supabase.from('estado_sector').select('*');
      // `status` es 0 cuando `fetch` ni siquiera obtuvo respuesta.
      if (error) throw new ErrorApiCliente(status);
      return (data as EstadoSectorFila[]).map(desdeFila);
    },
    suscribir(alCambiar) {
      const baja = cambios.suscribir(alCambiar);
      if (oyentes++ === 0) {
        // Nombre nuevo en cada apertura: `removeChannel` es asíncrono y el canal anterior sigue
        // registrado un momento (StrictMode monta, desmonta y vuelve a montar seguido). Mientras
        // tanto ese canal viejo calla, para no duplicar lo que ya avisa el nuevo.
        const apertura = ++aperturas;
        canal = supabase
          .channel(`estado_sector:${apertura}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'estado_sector' },
            (cambio) => {
              if (apertura === aperturas && cambio.eventType !== 'DELETE') {
                cambios.emitir(desdeFila(cambio.new as EstadoSectorFila));
              }
            },
          )
          .subscribe();
      }
      let activa = true;
      return () => {
        if (!activa) return;
        activa = false;
        baja();
        if (--oyentes === 0 && canal) {
          void supabase.removeChannel(canal);
          canal = null;
        }
      };
    },
  };
}
