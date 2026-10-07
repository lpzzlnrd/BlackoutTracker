import { defineConfig } from 'tsup';

// ESM para Vite y CJS para Nest, cada uno con sus tipos (index.d.ts e index.d.cts).
// No hay dependencias de runtime, así que no hay nada que externalizar.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'es2022',
});
