import { leerSectorId } from '../dominio/panel';
import { useParametro } from '../navegacion/ruta';
import { DetalleSector } from './DetalleSector';
import { ListaSectores } from './ListaSectores';

/**
 * Panel (S4): la lista de sectores y, con `?sector=<id>`, el detalle de uno (VIS-04). Misma ruta,
 * así el botón Atrás del navegador vuelve de un detalle a la lista.
 */
export function PantallaPanel() {
  const sector = useParametro('sector');
  return sector === null ? <ListaSectores /> : <DetalleSector sectorId={leerSectorId(sector)} />;
}
