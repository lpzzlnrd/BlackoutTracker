import { Contenido, EncabezadoPantalla } from '../componentes/marco/Marco';
import { EstadoChip } from '../componentes/ui/Chips';
import { Esqueleto, Mensaje } from '../componentes/ui/Mensaje';
import { SelectorServicio } from '../componentes/ui/SelectorServicio';
import { useEstadosSector, useSectores } from '../datos/consultas';
import { useServicio } from '../datos/preferencias';
import { estadoVisual } from '../dominio/estado-visual';

/** S2: la coropleta de Leaflet. Mientras tanto, los mismos datos en una lista. */
export function PantallaMapa() {
  const [servicio, elegir] = useServicio();
  const sectores = useSectores();
  const estados = useEstadosSector();

  return (
    <Contenido>
      <EncabezadoPantalla titulo="Mapa" descripcion="El mapa llega en S2." />
      <SelectorServicio valor={servicio} onChange={elegir} />
      {sectores.isError && <Mensaje tono="error">No se pudieron cargar los sectores.</Mensaje>}
      <ul className="flex flex-col gap-2">
        {sectores.isPending && <Esqueleto className="h-14" />}
        {sectores.data?.features.map((sector) => {
          const fila = estados.data?.find(
            (e) => e.sectorId === sector.properties.id && e.tipoServicio === servicio,
          );
          return (
            <li
              key={sector.id}
              className="flex items-center justify-between gap-3 rounded-tarjeta border border-borde bg-superficie p-3"
            >
              <span className="font-semibold">{sector.properties.nombre}</span>
              <EstadoChip estado={estadoVisual(fila)} />
            </li>
          );
        })}
      </ul>
    </Contenido>
  );
}
