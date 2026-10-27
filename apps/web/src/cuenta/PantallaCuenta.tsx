import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { cerrarSesion } from '../aplicacion/cerrar-sesion';
import { Contenido, EncabezadoPantalla } from '../componentes/marco/Marco';
import { AvisoInstalacion, SelectorTema } from '../componentes/ui/AvisosPwa';
import { Boton } from '../componentes/ui/Boton';
import { Icono } from '../componentes/ui/Icono';
import { Esqueleto, Mensaje } from '../componentes/ui/Mensaje';
import { useColaAvisos, usePerfil, useSesion } from '../datos/consultas';
import { usePuertos } from '../datos/contexto';
import { Enlace, navegar } from '../navegacion/ruta';

// Un `<a>` con el aspecto de los botones (Boton no es un enlace).
const ENLACE_PRIMARIO =
  'inline-flex h-12 w-full items-center justify-center gap-2 rounded-boton bg-acento px-5 text-base font-semibold text-sobre-acento';
const ENLACE_SECUNDARIO =
  'inline-flex h-11 items-center justify-center gap-2 rounded-control border border-borde-control bg-superficie px-4 text-sm font-semibold text-texto';

/** Cuenta: entrar si no hay sesión; si la hay, el correo, el sector y cerrar sesión. */
export function PantallaCuenta() {
  const usuario = useSesion();
  return (
    <Contenido>
      <EncabezadoPantalla titulo="Cuenta" />
      {usuario ? <ConSesion correo={usuario.correo} /> : <SinSesion />}
      <section className="flex flex-col gap-4 rounded-tarjeta border border-borde bg-superficie p-4 lg:p-6">
        <h2 className="text-lg leading-tight font-bold">Preferencias</h2>
        <SelectorTema />
        <div className="lg:hidden">
          <AvisoInstalacion />
        </div>
      </section>
    </Contenido>
  );
}

function SinSesion() {
  return (
    <section className="flex flex-col gap-3 rounded-tarjeta border border-borde bg-superficie p-4 lg:p-6">
      <h2 className="text-lg leading-tight font-bold">Entra para reportar</h2>
      <p className="text-sm text-secundario">
        El mapa y el panel se ven sin cuenta. Para avisar que se fue o volvió el servicio necesitas
        una, y marcar tu vivienda una sola vez.
      </p>
      <Enlace a="/entrar" consulta={{ siguiente: '/cuenta' }} className={ENLACE_PRIMARIO}>
        Entrar o crear cuenta
      </Enlace>
    </section>
  );
}

function ConSesion({ correo }: { correo: string }) {
  const puertos = usePuertos();
  const cliente = useQueryClient();
  const perfil = usePerfil();
  const cola = useColaAvisos();
  const [confirmar, setConfirmar] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sinEnviar = cola.data?.filter((a) => a.estado !== 'enviado').length ?? 0;

  async function salir() {
    setSaliendo(true);
    setError(null);
    try {
      await cerrarSesion(puertos);
      cliente.clear();
      // Las lecturas con sesión que guardó el service worker se indexan por URL, no por usuario.
      if ('caches' in window) await caches.delete('api-lecturas').catch(() => false);
      navegar('/');
    } catch {
      setError('No se pudo cerrar la sesión. Revisa tu conexión e inténtalo de nuevo.');
      setSaliendo(false);
    }
  }

  return (
    <>
      <section className="flex flex-col gap-4 rounded-tarjeta border border-borde bg-superficie p-4 lg:p-6">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 flex-none place-items-center rounded-chip bg-acento-suave text-acento">
            <Icono nombre="user" tamano={22} />
          </span>
          <div className="min-w-0">
            <p className="text-xs text-secundario">Correo</p>
            <p className="truncate font-semibold">{correo}</p>
          </div>
        </div>

        <div className="border-t border-borde pt-4">
          <h2 className="text-xs text-secundario">Tu sector</h2>
          {perfil.isPending ? (
            <Esqueleto className="mt-1 h-7 w-40" />
          ) : perfil.isError ? (
            <p className="mt-1 text-sm text-secundario">No se pudo cargar. Revisa tu conexión.</p>
          ) : perfil.data ? (
            <p className="mt-0.5 text-xl leading-tight font-bold">{perfil.data.sectorNombre}</p>
          ) : (
            <div className="mt-1 flex flex-col items-start gap-2">
              <p className="text-sm">Falta marcar tu vivienda para poder reportar.</p>
              <Enlace
                a="/registro"
                consulta={{ siguiente: '/cuenta' }}
                className={ENLACE_SECUNDARIO}
              >
                <Icono nombre="map" tamano={18} />
                Marcar mi vivienda
              </Enlace>
            </div>
          )}
        </div>
      </section>

      <section aria-label="Cerrar sesión" className="flex flex-col gap-3">
        {confirmar && sinEnviar > 0 ? (
          <>
            <Mensaje tono="aviso">
              {sinEnviar === 1
                ? 'Tienes 1 aviso sin enviar. Si cierras sesión, se perderá.'
                : `Tienes ${sinEnviar} avisos sin enviar. Si cierras sesión, se perderán.`}
            </Mensaje>
            <div className="flex flex-wrap gap-2">
              <Boton
                variante="peligro"
                icono="log-out"
                cargando={saliendo}
                onClick={() => void salir()}
              >
                Cerrar sesión igualmente
              </Boton>
              <Boton variante="secundario" disabled={saliendo} onClick={() => setConfirmar(false)}>
                Cancelar
              </Boton>
            </div>
          </>
        ) : (
          <Boton
            variante="peligro"
            icono="log-out"
            className="self-start"
            cargando={saliendo}
            onClick={() => (sinEnviar > 0 ? setConfirmar(true) : void salir())}
          >
            Cerrar sesión
          </Boton>
        )}
        {error && <Mensaje tono="error">{error}</Mensaje>}
      </section>
    </>
  );
}
