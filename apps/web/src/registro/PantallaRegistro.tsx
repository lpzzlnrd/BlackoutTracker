import { Contenido, EncabezadoPantalla } from '../componentes/marco/Marco';
import { Mensaje } from '../componentes/ui/Mensaje';

/** S1: el pin sobre la vivienda, una sola vez (REG, D-014). Se muestra si hay cuenta sin perfil. */
export function PantallaRegistro() {
  return (
    <Contenido>
      <EncabezadoPantalla titulo="Marca tu vivienda" />
      <Mensaje>En construcción (S1).</Mensaje>
    </Contenido>
  );
}
