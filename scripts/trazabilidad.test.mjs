// Tests del generador de docs/trazabilidad.md (T-060). Se corren con `pnpm test` (node --test).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cruzar, extraerIds, generarMarkdown, leerCasos } from './trazabilidad.mjs';

const PLAN = `# Casos
## REG — Registro
| ID | Caso | Entrada | Esperado | P |
|---|---|---|---|---|
| REG-01 | Pin dentro | x | y | A |
| REG-02 | Pin fuera | x | y | M |

## No funcionales
| ID | Atributo | Criterio |
|---|---|---|
| NF-06 | Privacidad | Sin coordenadas |
`;

test('leerCasos: toma el ID, el caso, la prioridad y el grupo de cada fila', () => {
  assert.deepEqual(leerCasos(PLAN), [
    { id: 'REG-01', caso: 'Pin dentro', prioridad: 'A', grupo: 'REG — Registro' },
    { id: 'REG-02', caso: 'Pin fuera', prioridad: 'M', grupo: 'REG — Registro' },
    { id: 'NF-06', caso: 'Privacidad', prioridad: '', grupo: 'No funcionales' },
  ]);
});

test('extraerIds: lee los IDs de los nombres de it, test, describe y .each', () => {
  const fuente = `
    describe('registro (REG-01)', () => {
      it('REG-01: pin dentro', () => {});
      it.skip("REP-07/OFF-03: hora del evento", () => {});
      test(\`CON-04: el mismo usuario
        cuenta como 1\`, () => {});
      it.each([[1, 2]])('EST-02: par %s', () => {});
    });`;
  assert.deepEqual(extraerIds(fuente), [
    'REG-01',
    'REG-01',
    'REP-07',
    'OFF-03',
    'CON-04',
    'EST-02',
  ]);
});

test('extraerIds: ignora los IDs fuera de los nombres de los tests', () => {
  const fuente = `
    // REG-02 en un comentario no cuenta
    const caso = 'CON-01';
    it('sin ID', () => expect(f('NF-06')).toBe(true));
    it('el T-050 y la D-015 no son casos', () => {});`;
  assert.deepEqual(extraerIds(fuente), []);
});

test('cruzar y generarMarkdown: cuentan los tests por archivo y separan los IDs fuera del plan', () => {
  const resultado = cruzar(leerCasos(PLAN), {
    'apps/api/test/b.e2e-spec.ts': ['REG-01', 'XYZ-99'],
    'apps/api/src/a.spec.ts': ['REG-01', 'REG-01'],
  });
  assert.deepEqual(resultado.casos[0].archivos, [
    { ruta: 'apps/api/src/a.spec.ts', tests: 2 },
    { ruta: 'apps/api/test/b.e2e-spec.ts', tests: 1 },
  ]);
  assert.deepEqual(resultado.casos[1].archivos, []);
  assert.deepEqual(resultado.fueraDelPlan, [
    { id: 'XYZ-99', archivos: [{ ruta: 'apps/api/test/b.e2e-spec.ts', tests: 1 }] },
  ]);

  const md = generarMarkdown(resultado);
  assert.match(
    md,
    /\| REG-01 \| Pin dentro \| A \| 3 \| `apps\/api\/src\/a\.spec\.ts` \(2\), `apps\/api\/test\/b\.e2e-spec\.ts` \(1\) \|/,
  );
  assert.match(md, /\| REG-02 \| Pin fuera \| M \| — \| sin test automatizado \|/);
  assert.match(md, /\| \*\*Total\*\* \| \*\*3\*\* \| \*\*1\*\* \| \*\*1 \/ 1\*\* \|/);
  assert.match(md, /## IDs en los tests que no están en el plan/);
});
