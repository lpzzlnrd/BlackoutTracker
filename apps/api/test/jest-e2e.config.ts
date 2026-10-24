import type { Config } from 'jest';

// Integración y e2e (Supertest) contra PostGIS en Docker: necesitan `pnpm db:up` (T-004).
const config: Config = {
  rootDir: '.',
  testRegex: '.*\\.e2e-spec\\.ts$',
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      { tsconfig: '<rootDir>/../tsconfig.json', diagnostics: { ignoreCodes: [151002] } },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  testEnvironment: 'node',
  globalSetup: '<rootDir>/global-setup.ts',
  setupFiles: ['<rootDir>/setup-env.ts'],
};

export default config;
