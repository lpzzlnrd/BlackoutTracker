import { Contenido, EncabezadoPantalla } from '../componentes/marco/Marco';
import { Mensaje } from '../componentes/ui/Mensaje';
import type { Ruta } from '../navegacion/ruta';

/**
 * S1: entrar o crear la cuenta (Supabase Auth, correo y clave). Se muestra en lugar de cualquier
 * pantalla que pida sesión; `siguiente` es adónde volver al terminar.
 */
export function PantallaEntrar({ siguiente = '/' }: { siguiente?: Ruta }) {
  return (
    <Contenido>
      <EncabezadoPantalla titulo="Entrar" />
      <Mensaje>En construcción (S1). Después se vuelve a {siguiente}.</Mensaje>
    </Contenido>
  );
}
