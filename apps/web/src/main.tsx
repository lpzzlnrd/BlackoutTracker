import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { crearSincronizador } from './aplicacion/sincronizar-cola';
import { vigilarConexion } from './aplicacion/vigilar-conexion';
import { componerPuertos, leerModo } from './datos/componer';
import { PuertosProvider } from './datos/contexto';
import { PreferenciasProvider } from './datos/preferencias';
import './estilos/globales.css';
import { registrarServiceWorker } from './pwa/registro';

async function arrancar(): Promise<void> {
  const raiz = document.getElementById('raiz');
  if (!raiz) throw new Error('Falta <div id="raiz"> en index.html.');

  const modo = leerModo(location.search);
  const puertos = await componerPuertos(modo);

  // Los puertos ya resuelven el modo offline: la consulta no debe pausarse sola sin red, o
  // nunca mostraría "lo último que se vio".
  const cliente = new QueryClient({
    defaultOptions: { queries: { networkMode: 'always', retry: 1, staleTime: 30_000 } },
  });

  vigilarConexion({ puertos, sincronizar: crearSincronizador(puertos) });
  // La sesión guardada se recupera antes de pintar, para no mostrar "Entrar" un instante. Sin red
  // Supabase puede tardar en rendirse: a los 2 s se pinta igual y la sesión llega cuando llegue.
  await Promise.race([
    puertos.sesion.restaurar().catch(() => null),
    new Promise((listo) => setTimeout(listo, 2000)),
  ]);
  if (import.meta.env.PROD && modo.tipo === 'real') registrarServiceWorker();

  createRoot(raiz).render(
    <StrictMode>
      <PuertosProvider puertos={puertos}>
        <QueryClientProvider client={cliente}>
          <PreferenciasProvider>
            <App />
          </PreferenciasProvider>
        </QueryClientProvider>
      </PuertosProvider>
    </StrictMode>,
  );
}

arrancar().catch((error: unknown) => {
  // Falla antes de que exista React (p. ej. faltan las variables de Supabase): se dice en claro.
  const raiz = document.getElementById('raiz') ?? document.body;
  raiz.textContent = error instanceof Error ? error.message : 'No se pudo iniciar la app.';
});
