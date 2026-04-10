import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    environment: 'node',
    // Maps bare 'electron' imports to our mock during tests.
    // Also maps the adapter package and peer dep references to their workspace
    // sources so both core shim tests and adapter package tests resolve correctly.
    alias: {
      electron: new URL('./tests/__mocks__/electron.ts', import.meta.url).pathname,
      '@electron-ipc-helper/adapter-assemblyscript': new URL(
        './packages/adapter-assemblyscript/src/index.ts',
        import.meta.url,
      ).pathname,
      '@electron-ipc-helper/adapter-named-pipe': new URL(
        './packages/adapter-named-pipe/src/index.ts',
        import.meta.url,
      ).pathname,
      '@electron-ipc-helper/adapter-grpc': new URL(
        './packages/adapter-grpc/src/index.ts',
        import.meta.url,
      ).pathname,
      '@electron-ipc-helper/adapter-stdio': new URL(
        './packages/adapter-stdio/src/index.ts',
        import.meta.url,
      ).pathname,
      // When the adapter package tests import peer deps (electron-ipc-helper,
      // electron-ipc-helper/plugins) resolve to workspace source directly.
      'electron-ipc-helper/plugins': new URL('./src/plugins.ts', import.meta.url).pathname,
      'electron-ipc-helper/transport': new URL('./src/transport.ts', import.meta.url).pathname,
      'electron-ipc-helper/boundary': new URL('./src/boundary.ts', import.meta.url).pathname,
      'electron-ipc-helper': new URL('./src/index.ts', import.meta.url).pathname,
      // Legacy package name aliases kept for compatibility in adapter tests.
      'electron-message-bridge-adapter-assemblyscript': fileURLToPath(new URL('./packages/adapter-assemblyscript/src/index.ts', import.meta.url)),
      'electron-message-bridge/plugins': fileURLToPath(new URL('./src/plugins.ts', import.meta.url)),
      'electron-message-bridge/transport': fileURLToPath(new URL('./src/transport.ts', import.meta.url)),
      'electron-message-bridge/boundary': fileURLToPath(new URL('./src/boundary.ts', import.meta.url)),
      'electron-message-bridge': fileURLToPath(new URL('./src/index.ts', import.meta.url)),
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
