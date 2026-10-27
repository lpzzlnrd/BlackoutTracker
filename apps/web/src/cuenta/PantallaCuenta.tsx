import { Contenido, EncabezadoPantalla } from '../componentes/marco/Marco';
import { Mensaje } from '../componentes/ui/Mensaje';

/** S1: la cuenta, el sector del residente y cerrar sesión (vacía la cola y la caché). */
export function PantallaCuenta() {
  return (
    <Contenido>
      <EncabezadoPantalla titulo="Cuenta" />
      <Mensaje>En construcción (S1).</Mensaje>
    </Contenido>
  );
}
