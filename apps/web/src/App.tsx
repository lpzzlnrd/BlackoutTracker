import { useColaAvisos, useEstadosSector, useSectores } from './datos/consultas';
import { type ModoApp } from './datos/componer';
import { usePuertos, useObservable } from './datos/contexto';
import { ETIQUETA_ESTADO, estadoVisual } from './dominio/estado-visual';
import { hora, nombreServicio } from './utils/formato';

/**
 * Pantalla provisional: no es ningún diseño del canon. Solo demuestra que la interfaz, los
 * puertos y los adaptadores (reales o de la demo) están cableados de punta a punta.
 */
export function App({ modo }: { modo: ModoApp }) {
  const { conexion } = usePuertos();
  const estadoConexion = useObservable(conexion);
  const sectores = useSectores();
  const estados = useEstadosSector();
  const cola = useColaAvisos();

  const pendientes = cola.data?.filter((a) => a.estado === 'pendiente').length ?? 0;
  const sinRed = estadoConexion.modo !== 'en-linea';

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col gap-4 p-4">
      {sinRed && (
        <p role="status" className="rounded-control bg-inverso-fondo p-3 text-inverso-texto">
          {estadoConexion.modo === 'servidor-caido' ? 'No se pudo actualizar' : 'Sin conexión'} ·
          datos no actualizados
          {estadoConexion.ultimaSincronizacion
            ? ` (${hora(estadoConexion.ultimaSincronizacion)})`
            : ''}
        </p>
      )}

      <h1 className="text-xl font-bold">BlackoutTracker</h1>
      {modo.tipo === 'demo' && (
        <p className="text-secundario">Modo demostración · {modo.escenario}</p>
      )}
      {pendientes > 0 && (
        <p className="text-secundario">
          {pendientes} {pendientes === 1 ? 'aviso pendiente' : 'avisos pendientes'} de envío
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {sectores.data?.features.flatMap((sector) =>
          (['electricidad', 'agua'] as const).map((servicio) => {
            const fila = estados.data?.find(
              (e) => e.sectorId === sector.properties.id && e.tipoServicio === servicio,
            );
            return (
              <li
                key={`${sector.id}/${servicio}`}
                className="flex items-center justify-between rounded-tarjeta border border-borde bg-superficie p-3"
              >
                <span>
                  {sector.properties.nombre} · {nombreServicio(servicio)}
                </span>
                <span className="text-secundario">{ETIQUETA_ESTADO[estadoVisual(fila)]}</span>
              </li>
            );
          }),
        )}
      </ul>
    </main>
  );
}
