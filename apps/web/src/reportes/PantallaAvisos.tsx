import { Contenido, EncabezadoPantalla } from '../componentes/marco/Marco';
import { Mensaje } from '../componentes/ui/Mensaje';
import { useColaAvisos } from '../datos/consultas';
import { textoSinEnviar } from '../dominio/aviso';
import { ListaAvisos } from './ListaAvisos';
import { useRefrescarTrasEnvio } from './useRefrescarTrasEnvio';
import { useSincronizarCola } from './useSincronizarCola';

/**
 * Tus avisos (OFF, D-037): la cola de este dispositivo en su propia pestaña, con la insignia de la
 * barra. No pide cuenta, como mirar (D-029): la cola es local y sin sesión está vacía, porque
 * cerrar la sesión la vacía.
 */
export function PantallaAvisos() {
  const cola = useColaAvisos();
  const sincronizar = useSincronizarCola();
  useRefrescarTrasEnvio();
  const pendientes = cola.data?.filter((a) => a.estado === 'pendiente').length ?? 0;

  return (
    <Contenido>
      <EncabezadoPantalla
        titulo="Tus avisos"
        descripcion="Lo que reportaste desde este dispositivo, del más reciente al más antiguo."
      />
      {pendientes > 0 && (
        <Mensaje tono="aviso">
          {textoSinEnviar(pendientes)} todavía. Se envían solos cuando hay conexión.
        </Mensaje>
      )}
      <ListaAvisos sincronizar={sincronizar} />
    </Contenido>
  );
}
