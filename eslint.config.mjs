// @ts-check
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Una sola configuración para todo el monorepo. `pnpm lint` corre `eslint .` desde la raíz.
// Las reglas con tipos (no-floating-promises, etc.) se activan solo en apps/api.
export default defineConfig(
  globalIgnores(['**/dist/', '**/coverage/', '**/dev-dist/']),

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

  // Siempre al final: apaga las reglas de estilo que chocan con Prettier.
  prettier,
);
