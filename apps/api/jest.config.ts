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
  collectCoverageFrom: ['**/*.ts', '!main.ts', '!**/*.module.ts'],
  coverageDirectory: '../coverage',
  // CLAUDE.md §7: cobertura ≥ 70 % en el consenso y en la estimación.
  coverageThreshold: {
    global: {}, // el tipo de Jest lo exige; sin cifras no exige nada en el total
    './src/estimacion/': { lines: 70, branches: 70 },
  },
};

export default config;
