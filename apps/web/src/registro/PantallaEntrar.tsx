import { useState, type FormEvent } from 'react';
import { Contenido, EncabezadoPantalla } from '../componentes/marco/Marco';
import { Boton } from '../componentes/ui/Boton';
import { Campo } from '../componentes/ui/Campo';
import { Mensaje } from '../componentes/ui/Mensaje';
import { usePuertos } from '../datos/contexto';
import {
  CLAVE_MINIMA,
  mensajeErrorAuth,
  validarCredenciales,
  type ErroresCredenciales,
} from '../dominio/credenciales';
import { navegar, useRuta, type Ruta } from '../navegacion/ruta';

type Modo = 'entrar' | 'crear';

/**
 * Entrar o crear la cuenta (Supabase Auth, correo y clave). Se muestra en `/entrar` o en lugar de
 * una pantalla que pide sesión (`RequiereVecino`): ahí, al entrar, la sesión cambia y esa pantalla
 * aparece sola; en `/entrar` se vuelve a `siguiente`.
 */
export function PantallaEntrar({ siguiente = '/' }: { siguiente?: Ruta }) {
  const { sesion } = usePuertos();
  const ruta = useRuta();
  const [modo, setModo] = useState<Modo>('entrar');
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [errores, setErrores] = useState<ErroresCredenciales>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const crear = modo === 'crear';

  const cambiarModo = () => {
    setModo(crear ? 'entrar' : 'crear');
    setErrores({});
    setErrorGeneral(null);
  };

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErrorGeneral(null);
    const encontrados = validarCredenciales(correo, clave);
    setErrores(encontrados);
    if (encontrados.correo || encontrados.clave) return; // REG-05: no se envía

    setEnviando(true);
    try {
      if (crear) await sesion.registrar(correo.trim(), clave);
      else await sesion.iniciar(correo.trim(), clave);
      if (ruta === '/entrar') navegar(siguiente, { reemplazar: true });
    } catch (error) {
      setErrorGeneral(mensajeErrorAuth(error));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Contenido>
      <EncabezadoPantalla
        titulo={crear ? 'Crear tu cuenta' : 'Entrar'}
        descripcion="Mirar el mapa no necesita cuenta. Para reportar sí: un sector cambia de estado cuando lo confirman varios vecinos distintos, y la cuenta es lo que los distingue."
      />

      <form
        noValidate
        onSubmit={(e) => void enviar(e)}
        className="flex flex-col gap-4 rounded-tarjeta border border-borde bg-superficie p-4 lg:p-6"
      >
        <Campo
          etiqueta="Correo"
          type="email"
          name="correo"
          autoComplete="email"
          inputMode="email"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          error={errores.correo}
        />
        <Campo
          etiqueta="Contraseña"
          type="password"
          name="clave"
          autoComplete={crear ? 'new-password' : 'current-password'}
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          error={errores.clave}
          ayuda={crear ? `Al menos ${CLAVE_MINIMA} caracteres.` : undefined}
        />

        {errorGeneral && <Mensaje tono="error">{errorGeneral}</Mensaje>}

        <Boton type="submit" ancho cargando={enviando}>
          {crear ? 'Crear cuenta' : 'Entrar'}
        </Boton>
      </form>

      <p className="flex flex-wrap items-center justify-center gap-x-1 text-sm text-secundario">
        {crear ? '¿Ya tienes cuenta?' : '¿Primera vez?'}
        <Boton variante="texto" onClick={cambiarModo}>
          {crear ? 'Entrar' : 'Crear una cuenta'}
        </Boton>
      </p>

      {crear && (
        <p className="text-[13px] text-secundario">
          Después marcarás tu vivienda en el mapa, una sola vez. Nadie ve tu ubicación: solo se usa
          para saber en qué sector estás.
        </p>
      )}
    </Contenido>
  );
}
