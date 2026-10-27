// @ts-check
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

// Una sola configuración para todo el monorepo. `pnpm lint` corre `eslint .` desde la raíz.
// Las reglas con tipos (no-floating-promises, etc.) se activan solo en apps/api.
export default defineConfig(
  // e2e/informe y e2e/resultados: el informe HTML y las trazas que genera Playwright.
  globalIgnores(['**/dist/', '**/coverage/', '**/dev-dist/', 'e2e/informe/', 'e2e/resultados/']),

  js.configs.recommended,
  tseslint.configs.recommended,

  {
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      // Los parámetros con _ se permiten sin usar (frecuente en Nest: guards, filtros, pipes).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  // Reglas con información de tipos, solo para el código de la API.
  {
    files: ['apps/api/**/*.ts'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
    },
  },

  // Frontend: navegador, hooks de React y la frontera de la arquitectura de puertos y adaptadores.
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
    },
  },
  {
    files: ['apps/web/src/pwa/sw.ts'],
    languageOptions: { globals: globals.serviceworker },
  },

  // La capa pura no conoce ninguna librería del frontend: dominio, casos de uso, utilidades,
  // los puertos y los mocks (la demo) se prueban en Node y funcionan igual con cualquier
  // adaptador. Solo `adaptadores/{http,dexie,supabase,navegador}` y la interfaz las importan.
  {
    files: [
      'apps/web/src/dominio/**/*.ts',
      'apps/web/src/aplicacion/**/*.ts',
      'apps/web/src/utils/**/*.ts',
      'apps/web/src/datos/puertos/**/*.ts',
      'apps/web/src/datos/adaptadores/mock/**/*.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react/*', 'react-dom', 'react-dom/*', 'dexie', 'dexie/*'],
              message: 'La capa pura no depende de React ni de Dexie: usa un puerto.',
            },
            {
              group: ['@tanstack/*', '@supabase/*', 'workbox-*', 'virtual:*'],
              message: 'La capa pura no depende de TanStack, Supabase ni Workbox: usa un puerto.',
            },
            {
              group: [
                '**/adaptadores/http/*',
                '**/adaptadores/dexie/*',
                '**/adaptadores/supabase/*',
                '**/adaptadores/navegador/*',
              ],
              message: 'Los casos de uso y los mocks no importan adaptadores reales.',
            },
          ],
        },
      ],
    },
  },

  // Siempre al final: apaga las reglas de estilo que chocan con Prettier.
  prettier,
);
