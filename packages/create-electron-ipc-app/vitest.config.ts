import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: [fileURLToPath(new URL('../../tests/vitest-ssr-shim.ts', import.meta.url))],
    include: ['tests/**/*.test.ts'],
  },
});
