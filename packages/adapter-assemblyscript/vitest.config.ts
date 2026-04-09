import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: [fileURLToPath(new URL('../../tests/vitest-ssr-shim.ts', import.meta.url))],
    alias: {
      // Maps bare 'electron' imports to our mock during tests
      electron: fileURLToPath(new URL('./tests/__mocks__/electron.ts', import.meta.url)),
      // Maps the peer dep to the workspace root's source during tests
      'electron-ipc-helper/plugins': fileURLToPath(new URL('../../src/plugins.ts', import.meta.url)),
      'electron-ipc-helper': fileURLToPath(new URL('../../src/index.ts', import.meta.url)),
    },
    typecheck: {
      tsconfig: './tsconfig.json',
    },
  },
});
