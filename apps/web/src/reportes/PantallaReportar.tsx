import { Contenido, EncabezadoPantalla } from '../componentes/marco/Marco';
import { Mensaje } from '../componentes/ui/Mensaje';

/** S3: "Se fue / Ya volvió" con la hora real, siempre a través de la cola (REP, OFF). */
export function PantallaReportar() {
  return (
    <Contenido>
      <EncabezadoPantalla titulo="Reportar" />
      <Mensaje>En construcción (S3).</Mensaje>
    </Contenido>
  );
}
