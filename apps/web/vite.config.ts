import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vite';
import { alias } from './vite.alias.ts';

// Colores del manifest: el `--fondo` claro de la propuesta A (PWA.md §2).
const COLOR_FONDO = '#f8fafc';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src/pwa',
      filename: 'sw.ts',
      registerType: 'prompt', // las versiones nuevas se ofrecen, no se imponen
      injectRegister: false, // se registra a mano desde src/pwa/registro.ts
      manifest: {
        id: '/',
        name: 'BlackoutTracker',
        short_name: 'Blackout',
        description: 'Cortes de agua y luz en Guaparo, reportados por los vecinos.',
        lang: 'es-VE',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: COLOR_FONDO,
        theme_color: COLOR_FONDO,
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/pwa-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          {
            name: 'Reportar',
            url: '/reportar',
            icons: [{ src: '/pwa-192.png', sizes: '192x192' }],
          },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: { alias },
  server: {
    // En desarrollo la API de Nest escucha en el 3000; el front la ve como `/api`, sin CORS.
    proxy: { '/api': 'http://localhost:3000' },
  },
});
