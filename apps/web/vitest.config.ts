import { defineConfig } from 'vitest/config';
import { alias } from './vite.alias.ts';

// Sin los plugins de React, Tailwind ni PWA: las pruebas son de la capa pura y corren en Node.
export default defineConfig({
  resolve: { alias },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
