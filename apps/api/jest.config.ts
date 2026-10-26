import type { Config } from 'jest';

// Pruebas unitarias: `src/**/*.spec.ts`. Las de integración y e2e están en `test/` (jest-e2e.config.ts).
const config: Config = {
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      { tsconfig: '<rootDir>/../tsconfig.json', diagnostics: { ignoreCodes: [151002] } },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  testEnvironment: 'node',
  // Los servicios, controladores y DTOs con base de datos los cubre `pnpm test:int`; el umbral mide
  // la lógica pura de consenso y estimación, que es la que corre aquí.
  collectCoverageFrom: [
    '**/*.ts',
    '!main.ts',
    '!**/*.module.ts',
    '!**/*.service.ts',
    '!**/*.controller.ts',
    '!**/dto/**',
  ],
  coverageDirectory: '../coverage',
  // CLAUDE.md §7: cobertura ≥ 70 % en el consenso y en la estimación.
  coverageThreshold: {
    global: {}, // el tipo de Jest lo exige; sin cifras no exige nada en el total
    './src/consenso/': { lines: 70, branches: 70 },
    './src/estimacion/': { lines: 70, branches: 70 },
  },
};

export default config;
