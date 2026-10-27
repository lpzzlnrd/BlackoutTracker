import { defineConfig, devices } from '@playwright/test';

// En Docker la web es http://web (la red de compose); en local, la de `pnpm app:up`.
const URL = process.env.E2E_URL ?? 'http://localhost:8080';

export default defineConfig({
  testDir: './pruebas',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'informe', open: 'never' }]],
  outputDir: 'resultados',
  use: {
    baseURL: URL,
    locale: 'es-VE',
    timezoneId: 'America/Caracas',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // `http://web` no es un origen seguro: sin esto no hay service worker ni `crypto.randomUUID`.
    launchOptions: { args: [`--unsafely-treat-insecure-origin-as-secure=${URL}`] },
  },
  projects: [
    { name: 'telefono', use: { ...devices['Pixel 7'] } },
    {
      name: 'escritorio',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 860 } },
    },
  ],
});
