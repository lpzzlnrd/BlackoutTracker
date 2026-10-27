import type { ReactNode } from 'react';
import { Contenido, Marco } from './componentes/marco/Marco';
import { Boton } from './componentes/ui/Boton';
import { Esqueleto, Mensaje } from './componentes/ui/Mensaje';
import { PantallaCuenta } from './cuenta/PantallaCuenta';
import { usePerfil, useSesion } from './datos/consultas';
import { PantallaMapa } from './mapa/PantallaMapa';
import { rutaSegura, useParametro, useRuta, type Ruta } from './navegacion/ruta';
import { PantallaPanel } from './panel/PantallaPanel';
import { PantallaEntrar } from './registro/PantallaEntrar';
import { PantallaRegistro } from './registro/PantallaRegistro';
import { PantallaReportar } from './reportes/PantallaReportar';

/**
 * Mirar es público (D-029): el mapa y el panel no piden cuenta. Reportar sí, porque el consenso
 * cuenta vecinos distintos (CON-04) y el sector sale del pin del registro (REG).
 */
export function App() {
  const ruta = useRuta();
  const siguiente = rutaSegura(useParametro('siguiente'));
  return <Marco>{pantalla(ruta, siguiente)}</Marco>;
}

function pantalla(ruta: Ruta, siguiente: Ruta): ReactNode {
  switch (ruta) {
    case '/':
      return <PantallaMapa />;
    case '/panel':
      return <PantallaPanel />;
    case '/reportar':
      return (
        <RequiereVecino ruta="/reportar">
          <PantallaReportar />
        </RequiereVecino>
      );
    case '/cuenta':
      return <PantallaCuenta />;
    case '/entrar':
      return <PantallaEntrar siguiente={siguiente} />;
    case '/registro':
      return (
        <RequiereVecino ruta={siguiente}>
          <PantallaRegistroHecho />
        </RequiereVecino>
      );
  }
}

/**
 * Sin sesión muestra Entrar; con cuenta pero sin pin, el registro (D-014). Lo hace en el sitio, sin
 * redirigir: al terminar, la misma ruta muestra lo que se pidió.
 */
export function RequiereVecino({ ruta, children }: { ruta: Ruta; children: ReactNode }) {
  const usuario = useSesion();
  const perfil = usePerfil();

  if (!usuario) return <PantallaEntrar siguiente={ruta} />;
  if (perfil.isPending) {
    return (
      <Contenido>
        <Esqueleto className="h-8 w-40" />
        <Esqueleto className="h-24" />
      </Contenido>
    );
  }
  if (perfil.isError) {
    return (
      <Contenido>
        <Mensaje tono="error">No pudimos comprobar tu registro. Revisa tu conexión.</Mensaje>
        <Boton variante="secundario" icono="refresh-cw" onClick={() => void perfil.refetch()}>
          Reintentar
        </Boton>
      </Contenido>
    );
  }
  if (perfil.data === null) return <PantallaRegistro />;
  return children;
}

/** `/registro` con el perfil ya creado: no hay nada que registrar, se va a la cuenta. */
function PantallaRegistroHecho() {
  return <PantallaCuenta />;
}
