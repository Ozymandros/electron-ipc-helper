import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Maps bare 'electron' imports to our mock during tests
    alias: {
      electron: new URL('./tests/__mocks__/electron.ts', import.meta.url).pathname,
    },
    typecheck: {
      tsconfig: './tsconfig.typecheck.json',
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/types.ts'],
      reporter: ['text', 'html'],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
