#!/usr/bin/env node
// Verifica los tokens del canon del frontend (docs/frontend/tokens/*.css):
//   1. contraste WCAG de los pares de color que usan las maquetas, en claro y en oscuro;
//   2. que cada token de color tenga su par oscuro;
//   3. que todo color de las maquetas de pantalla (referencia/*.html) exista como token;
//   4. que los cuatro estados del mapa se distingan entre sí con visión normal y con protanopía,
//      deuteranopía y tritanopía (simulación de Machado et al., 2009; ΔE de CIELAB al menos 15).
// Uso: node docs/frontend/herramientas/verificar-tokens.mjs   (sale con código 1 si algo falla)
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (...partes) => readFileSync(join(raiz, ...partes), 'utf8');

// Lee bloques "selector { --token: valor; }" de un CSS y devuelve { selector: { token: valor } }.
function bloques(css) {
  const limpio = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const salida = {};
  for (const [, selector, cuerpo] of limpio.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const variables = {};
    for (const declaracion of cuerpo.split(';')) {
      const coincide = declaracion.match(/^\s*--([\w-]+)\s*:\s*([\s\S]+?)\s*$/);
      if (coincide) variables[coincide[1]] = coincide[2];
    }
    salida[selector.trim()] = variables;
  }
  return salida;
}

const comun = bloques(leer('tokens', 'comun.css'));
const propuestas = ['a', 'b', 'c'];
const css = Object.fromEntries(propuestas.map((p) => [p, bloques(leer('tokens', `${p}.css`))]));

// Resuelve los var(--x) simples que apuntan a otro token.
function resolver(variables) {
  const resuelto = { ...variables };
  for (let pasada = 0; pasada < 3; pasada++) {
    for (const clave of Object.keys(resuelto)) {
      resuelto[clave] = resuelto[clave].replace(
        /var\(--([\w-]+)\)/g,
        (_, nombre) => resuelto[nombre] ?? `var(--${nombre})`,
      );
    }
  }
  return resuelto;
}

function tema(propuesta, modo) {
  const selector = `:root[data-diseno='${propuesta}']`;
  let variables = { ...comun[':root'], ...css[propuesta][selector] };
  if (modo === 'oscuro') {
    variables = { ...variables, ...comun[':root.dark'], ...css[propuesta][`${selector}.dark`] };
  }
  return resolver(variables);
}

const linealizar = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const canales = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const luminancia = (hex) => {
  const [r, g, b] = canales(hex).map(linealizar);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contraste = (a, b) => {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (oscuro + 0.05);
};

// Simulación de daltonismo (Machado, Oliveira y Fernandes, 2009; severidad 1) en RGB lineal.
const VISIONES = {
  'visión normal': [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
  protanopía: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopía: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopía: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};
const DELTA_E_MINIMO = 15;

// Color de un relleno con opacidad sobre la base del mapa, en RGB lineal.
const mezclar = (relleno, base, opacidad) => {
  const f = canales(relleno).map(linealizar);
  const b = canales(base).map(linealizar);
  return f.map((valor, i) => valor * opacidad + b[i] * (1 - opacidad));
};
const simular = (lineal, matriz) =>
  matriz.map((fila) =>
    Math.min(1, Math.max(0, fila[0] * lineal[0] + fila[1] * lineal[1] + fila[2] * lineal[2])),
  );
const aLab = ([r, g, b]) => {
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
  const y = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
  const z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
};
const deltaE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

let problemas = 0;
const minimos = new Map(); // categoría -> { valor, minimo }

function par(categoria, minimo, t, primero, segundo, contexto) {
  const a = t[primero];
  const b = t[segundo];
  if (!/^#/.test(a ?? '') || !/^#/.test(b ?? '')) {
    problemas++;
    console.log(`FALTA ${contexto}: ${primero} o ${segundo}`);
    return;
  }
  const valor = contraste(a, b);
  const previo = minimos.get(categoria);
  if (!previo || valor < previo.valor) minimos.set(categoria, { valor, minimo });
  if (valor < minimo) {
    problemas++;
    console.log(
      `FALLA ${valor.toFixed(2)}:1 (mínimo ${minimo}) ${contexto}: ${primero}/${segundo}`,
    );
  }
}

for (const p of propuestas) {
  for (const modo of ['claro', 'oscuro']) {
    const t = tema(p, modo);
    const ctx = `${p.toUpperCase()} ${modo}`;
    for (const fondo of ['fondo', 'superficie', 'superficie-2']) {
      par('texto', 4.5, t, 'texto', fondo, ctx);
      par('texto-2', 4.5, t, 'texto-2', fondo, ctx);
      par('secundario', 4.5, t, 'secundario', fondo, ctx);
    }
    par('texto sobre acento', 4.5, t, 'sobre-acento', 'acento', ctx);
    par('acento como enlace', 4.5, t, 'acento', 'superficie', ctx);
    par('tinta sobre acento suave', 4.5, t, 'tinta-acento', 'acento-suave', ctx);
    par('borde de control (interfaz, 3:1)', 3, t, 'borde-control', 'superficie', ctx);
    par('foco (interfaz, 3:1)', 3, t, 'foco', 'fondo', ctx);
    par('foco (interfaz, 3:1)', 3, t, 'foco', 'superficie', ctx);
    par('aviso inverso', 4.5, t, 'inverso-texto', 'inverso-fondo', ctx);
    par('aviso inverso', 4.5, t, 'inverso-sobre-acento', 'inverso-acento', ctx);
    for (const estado of ['con-servicio', 'sin-servicio', 'sin-confirmar', 'sin-datos']) {
      par('chip de estado', 4.5, t, `estado-${estado}-tinta`, `estado-${estado}-chip`, ctx);
      par(
        'trazo de estado sobre el mapa (interfaz, 3:1)',
        3,
        t,
        `estado-${estado}-trazo`,
        'mapa-base',
        ctx,
      );
    }
  }
}

// Los cuatro estados del mapa deben distinguirse entre sí por su relleno, también con daltonismo.
const ESTADOS = ['con-servicio', 'sin-confirmar', 'sin-servicio', 'sin-datos'];
let distanciaMinima = Infinity;
for (const p of propuestas) {
  for (const modo of ['claro', 'oscuro']) {
    const t = tema(p, modo);
    const rellenos = ESTADOS.map((e) =>
      mezclar(t[`estado-${e}-relleno`], t['mapa-base'], parseFloat(t[`estado-${e}-opacidad`])),
    );
    for (const [vision, matriz] of Object.entries(VISIONES)) {
      for (let i = 0; i < ESTADOS.length; i++) {
        for (let j = i + 1; j < ESTADOS.length; j++) {
          const d = deltaE(aLab(simular(rellenos[i], matriz)), aLab(simular(rellenos[j], matriz)));
          distanciaMinima = Math.min(distanciaMinima, d);
          if (d < DELTA_E_MINIMO) {
            problemas++;
            console.log(
              `POCO DISTINGUIBLES ΔE ${d.toFixed(1)} (${vision}) ${p.toUpperCase()} ${modo}: ${ESTADOS[i]} / ${ESTADOS[j]}`,
            );
          }
        }
      }
    }
  }
}

// Todo token de color claro debe tener su par oscuro (salvo arte del mapa, formas y tipografía).
const exentos = /^(mapa-(calle|calle-borde|parque|halo|insignia)|radio-|sombra-|fuente-)/;
for (const p of propuestas) {
  const selector = `:root[data-diseno='${p}']`;
  const claro = Object.keys({ ...comun[':root'], ...css[p][selector] });
  const oscuro = new Set(Object.keys({ ...comun[':root.dark'], ...css[p][`${selector}.dark`] }));
  const sinPar = claro.filter((k) => !oscuro.has(k) && !exentos.test(k));
  if (sinPar.length > 0) {
    problemas += sinPar.length;
    console.log(`SIN PAR OSCURO en ${p.toUpperCase()}: ${sinPar.join(', ')}`);
  }
}

// Todo color hex de las maquetas de pantalla debe existir como token de su propuesta.
const pantallas = {
  a: ['a-telefono.html', 'a-escritorio.html'],
  b: ['b-telefono.html', 'b-escritorio.html'],
  c: ['c-telefono.html', 'c-escritorio.html'],
};
for (const p of propuestas) {
  const claro = Object.values(tema(p, 'claro')).map((v) => v.toUpperCase());
  const conocidos = new Set(claro.filter((v) => /^#/.test(v)));
  const html = pantallas[p]
    .map((f) => leer('referencia', f).replace(/<!--[\s\S]*?-->/g, ''))
    .join('\n');
  const usados = [...new Set((html.match(/#[0-9A-Fa-f]{6}\b/g) ?? []).map((c) => c.toUpperCase()))];
  const sinToken = usados.filter((c) => !conocidos.has(c) && c !== '#FFFFFF');
  if (sinToken.length > 0) {
    problemas += sinToken.length;
    console.log(`COLORES SIN TOKEN en ${p.toUpperCase()}: ${sinToken.join(' ')}`);
  }
}

console.log('Contraste mínimo encontrado en las 3 propuestas, claro y oscuro:');
for (const [categoria, { valor, minimo }] of minimos) {
  console.log(`  ${valor.toFixed(1).padStart(5)}:1  (exigido ${minimo})  ${categoria}`);
}
console.log(
  `  ${distanciaMinima.toFixed(1).padStart(5)} ΔE  (exigido ${DELTA_E_MINIMO})  estados del mapa entre sí, daltonismo incluido`,
);
console.log(problemas === 0 ? 'Tokens correctos.' : `Problemas: ${problemas}`);
process.exitCode = problemas === 0 ? 0 : 1;
