// El paquete tiene que poder consumirse desde Nest (CJS, tipos `.d.cts`) y desde Vite (ESM, resolución
// `bundler`). Aquí se comprueba ya compilado y tal como lo ve un consumidor: por su nombre, a través
// del mapa `exports`. Mientras no exista apps/api (T-003), estos tests hacen de su consumidor.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const raiz = fileURLToPath(new URL('..', import.meta.url));
const ruta = (relativa) => new URL(`../${relativa}`, import.meta.url);
const leer = (relativa) => readFileSync(ruta(relativa), 'utf8');

test('dist trae el JS y los tipos de ESM y de CJS', () => {
  for (const archivo of ['index.js', 'index.cjs', 'index.d.ts', 'index.d.cts']) {
    assert.ok(existsSync(ruta(`dist/${archivo}`)), `falta dist/${archivo}`);
  }
});

test('no tiene dependencias de runtime, ni declaradas ni en el código compilado', () => {
  const paquete = JSON.parse(leer('package.json'));
  assert.equal(paquete.dependencies, undefined);
  assert.equal(paquete.peerDependencies, undefined);

  const esm = leer('dist/index.js');
  assert.doesNotMatch(esm, /^\s*import\b/m);
  assert.doesNotMatch(esm, /\bfrom\s*["']/);
  assert.doesNotMatch(leer('dist/index.cjs'), /\brequire\(/);
});

test('se importa por su nombre desde ESM y desde CJS y exporta lo mismo', async () => {
  const esm = await import('@blackout/shared');
  const cjs = require('@blackout/shared');

  assert.deepEqual(Object.keys(esm).sort(), Object.keys(cjs).sort());
  for (const clave of Object.keys(esm)) {
    assert.deepEqual(cjs[clave], esm[clave], clave);
  }
});

// Cada tsconfig compila los consumidores de prueba de test/consumo/. Esos archivos usan
// `@ts-expect-error`: si un tipo se resolviera como `any`, la directiva sobraría y tsc fallaría.
const tsc = require.resolve('typescript/bin/tsc');

for (const [modo, tsconfig] of [
  ['nodenext (Nest compila a CJS, Node carga ESM)', 'tsconfig.nodenext.json'],
  ['bundler (Vite)', 'tsconfig.bundler.json'],
]) {
  test(`los tipos se resuelven y se comportan con moduleResolution ${modo}`, () => {
    const resultado = spawnSync(process.execPath, [tsc, '-p', `test/consumo/${tsconfig}`], {
      cwd: raiz,
      encoding: 'utf8',
    });
    assert.equal(resultado.status, 0, `${resultado.stdout}${resultado.stderr}`);
  });
}
