// Uso: pnpm docs:trazabilidad   (escribe docs/trazabilidad.md)
//
// Cruza los IDs del plan de pruebas (docs/casos-de-prueba.md) con los nombres de los tests de
// `apps/` y `packages/` (`it`, `test` y `describe`, también `.each`), para la trazabilidad de
// docs/PLAN.md §8. La salida no lleva fecha: si nada cambió, volver a generarla no deja diff (T-060).
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Un ID de caso: 2 o 3 mayúsculas, guion y dos dígitos (`REG-01`, `NF-06`, `ACE-03`). */
const ID = /\b[A-Z]{2,3}-\d{2}\b/g;
const ID_EXACTO = /^[A-Z]{2,3}-\d{2}$/;
const PRIORIDADES = new Set(['A', 'M', 'B']);
const ARCHIVO_DE_TEST = /\.(?:e2e-)?(?:spec|test)\.[cm]?[jt]sx?$/;
const CARPETAS_IGNORADAS = new Set(['node_modules', 'dist', 'dev-dist', 'coverage', '.turbo']);

/**
 * Nombre de un test: el primer argumento literal de `describe`, `it` o `test` (con `.only`, `.skip`,
 * `.concurrent` o `.todo`), o el de la llamada que sigue a un `.each(...)`, que empieza por `)(`.
 */
const NOMBRE_DE_TEST =
  /(?:\b(?:describe|it|test)(?:\.(?:only|skip|concurrent|todo))?|\))\s*\(\s*(['"`])((?:\\.|(?!\1)[^\\])*?)\1/g;

/**
 * Los casos del plan, en orden: cada fila de tabla cuya primera celda es un ID. El grupo es el
 * título `##` bajo el que está la tabla; la prioridad, la última celda si es A, M o B.
 */
export function leerCasos(markdown) {
  const casos = [];
  let grupo = '';
  for (const linea of markdown.split(/\r?\n/)) {
    if (linea.startsWith('## ')) {
      grupo = linea.slice(3).trim();
      continue;
    }
    if (!linea.trimStart().startsWith('|')) continue;
    const celdas = linea
      .trim()
      .replace(/^\||\|$/g, '')
      .split('|')
      .map((c) => c.trim());
    if (!ID_EXACTO.test(celdas[0])) continue;
    const ultima = celdas[celdas.length - 1];
    casos.push({
      id: celdas[0],
      caso: celdas[1] ?? '',
      prioridad: PRIORIDADES.has(ultima) ? ultima : '',
      grupo,
    });
  }
  return casos;
}

/** Los IDs que aparecen en los nombres de los tests de un archivo, con repetición (uno por test). */
export function extraerIds(fuente) {
  const ids = [];
  for (const [, , nombre] of fuente.matchAll(NOMBRE_DE_TEST)) {
    for (const [id] of nombre.matchAll(ID)) ids.push(id);
  }
  return ids;
}

/** Rutas (relativas a `raiz`, con `/`) de los archivos de test bajo `apps/` y `packages/`. */
export function buscarArchivosDeTest(raiz) {
  const encontrados = [];
  const recorrer = (carpeta) => {
    let entradas;
    try {
      entradas = readdirSync(carpeta, { withFileTypes: true });
    } catch {
      return; // la carpeta no existe (p. ej. apps/web en una rama sin front)
    }
    for (const e of entradas) {
      const ruta = join(carpeta, e.name);
      if (e.isDirectory()) {
        if (!CARPETAS_IGNORADAS.has(e.name)) recorrer(ruta);
      } else if (ARCHIVO_DE_TEST.test(e.name)) {
        encontrados.push(relative(raiz, ruta).split(sep).join('/'));
      }
    }
  };
  for (const base of ['apps', 'packages']) recorrer(join(raiz, base));
  return encontrados.sort();
}

/**
 * Une los casos con los IDs de cada archivo (`{ ruta: ids[] }`). Devuelve cada caso con sus
 * archivos y la cantidad de tests por archivo, y aparte los IDs de los tests que no están en el plan.
 */
export function cruzar(casos, idsPorArchivo) {
  const conocidos = new Set(casos.map((c) => c.id));
  const porId = new Map();
  const fueraDelPlan = new Map();
  for (const ruta of Object.keys(idsPorArchivo).sort()) {
    for (const id of idsPorArchivo[ruta]) {
      const destino = conocidos.has(id) ? porId : fueraDelPlan;
      if (!destino.has(id)) destino.set(id, new Map());
      const archivos = destino.get(id);
      archivos.set(ruta, (archivos.get(ruta) ?? 0) + 1);
    }
  }
  const aLista = (archivos) =>
    [...(archivos ?? new Map())].map(([ruta, tests]) => ({ ruta, tests }));
  return {
    casos: casos.map((c) => ({ ...c, archivos: aLista(porId.get(c.id)) })),
    fueraDelPlan: [...fueraDelPlan.keys()]
      .sort()
      .map((id) => ({ id, archivos: aLista(fueraDelPlan.get(id)) })),
  };
}

const celda = (texto) => texto.replace(/\|/g, '\\|');
const dondeSeProbo = (archivos) =>
  archivos.length === 0
    ? 'sin test automatizado'
    : archivos.map((a) => `\`${a.ruta}\` (${a.tests})`).join(', ');

/** El Markdown de docs/trazabilidad.md. */
export function generarMarkdown({ casos, fueraDelPlan }) {
  const grupos = [...new Set(casos.map((c) => c.grupo))];
  const conTest = (lista) => lista.filter((c) => c.archivos.length > 0).length;
  const prioridadA = (lista) => {
    const a = lista.filter((c) => c.prioridad === 'A');
    return a.length === 0 ? '—' : `${conTest(a)} / ${a.length}`;
  };

  const l = [
    '# Trazabilidad — casos de prueba ↔ tests automatizados',
    '',
    '> **Archivo generado** por `pnpm docs:trazabilidad` (`scripts/trazabilidad.mjs`). No se edita a mano.',
    '> Cruza los IDs de `docs/casos-de-prueba.md` con los nombres de los tests (`it`, `test`, `describe`) de `apps/` y `packages/`; la columna *Tests* cuenta los tests cuyo nombre lleva el ID.',
    '> "Sin test automatizado" no significa "sin probar": los casos de la interfaz se prueban en `apps/web` (Vitest y Playwright), y los de aceptación y varios no funcionales (red lenta, Lighthouse, SUS) se ejecutan a mano o en campo.',
    '',
    '## Resumen',
    '',
    '| Grupo | Casos | Con test | Prioridad A con test |',
    '|---|---|---|---|',
  ];
  for (const g of grupos) {
    const lista = casos.filter((c) => c.grupo === g);
    l.push(`| ${celda(g)} | ${lista.length} | ${conTest(lista)} | ${prioridadA(lista)} |`);
  }
  l.push(`| **Total** | **${casos.length}** | **${conTest(casos)}** | **${prioridadA(casos)}** |`);

  for (const g of grupos) {
    l.push('', `## ${g}`, '', '| ID | Caso | P | Tests | Dónde |', '|---|---|---|---|---|');
    for (const c of casos.filter((x) => x.grupo === g)) {
      const tests = c.archivos.reduce((s, a) => s + a.tests, 0);
      l.push(
        `| ${c.id} | ${celda(c.caso)} | ${c.prioridad || '—'} | ${tests || '—'} | ${dondeSeProbo(c.archivos)} |`,
      );
    }
  }

  if (fueraDelPlan.length > 0) {
    l.push(
      '',
      '## IDs en los tests que no están en el plan',
      '',
      'Revisar: o falta el caso en `docs/casos-de-prueba.md`, o el ID del test está mal escrito.',
      '',
      '| ID | Dónde |',
      '|---|---|',
      ...fueraDelPlan.map((f) => `| ${f.id} | ${dondeSeProbo(f.archivos)} |`),
    );
  }
  return `${l.join('\n')}\n`;
}

function main() {
  const raiz = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const casos = leerCasos(readFileSync(join(raiz, 'docs/casos-de-prueba.md'), 'utf-8'));
  const idsPorArchivo = {};
  for (const ruta of buscarArchivosDeTest(raiz)) {
    const ids = extraerIds(readFileSync(join(raiz, ruta), 'utf-8'));
    if (ids.length > 0) idsPorArchivo[ruta] = ids;
  }
  const resultado = cruzar(casos, idsPorArchivo);
  writeFileSync(join(raiz, 'docs/trazabilidad.md'), generarMarkdown(resultado));
  const cubiertos = resultado.casos.filter((c) => c.archivos.length > 0).length;
  console.log(
    `docs/trazabilidad.md: ${cubiertos} de ${casos.length} casos con test, ` +
      `${Object.keys(idsPorArchivo).length} archivos con IDs.`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
