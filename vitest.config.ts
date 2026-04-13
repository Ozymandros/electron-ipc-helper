import { defineConfig } from 'vitest/config';

const bridgeRoot = import.meta.url;

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'tests/**/*.test.ts',
      'tests/**/*.test-d.ts',
      'packages/adapter-grpc/tests/**/*.test.ts',
      'packages/adapter-named-pipe/tests/**/*.test.ts',
      'packages/adapter-stdio/tests/**/*.test.ts',
      'packages/adapter-assemblyscript/tests/**/*.test.ts',
      'packages/create-electron-ipc-app/tests/**/*.test.ts',
      'packages/plugin-speech-whisper/tests/**/*.test.ts',
    ],
    exclude: ['**/node_modules/**', '**/dist/**', '**/__mocks__/**'],
    alias: {
      electron: new URL('./tests/__mocks__/electron.ts', bridgeRoot).pathname,
      '@electron-message-bridge/adapter-assemblyscript': new URL(
        './packages/adapter-assemblyscript/src/index.ts',
        bridgeRoot,
      ).pathname,
      '@electron-message-bridge/adapter-named-pipe': new URL(
        './packages/adapter-named-pipe/src/index.ts',
        bridgeRoot,
      ).pathname,
      '@electron-message-bridge/adapter-grpc': new URL('./packages/adapter-grpc/src/index.ts', bridgeRoot).pathname,
      '@electron-message-bridge/adapter-stdio': new URL('./packages/adapter-stdio/src/index.ts', bridgeRoot).pathname,
      'electron-message-bridge/plugins': new URL('./src/plugins.ts', bridgeRoot).pathname,
      'electron-message-bridge/transport': new URL('./src/transport.ts', bridgeRoot).pathname,
      'electron-message-bridge/boundary': new URL('./src/boundary.ts', bridgeRoot).pathname,
      'electron-message-bridge': new URL('./src/index.ts', bridgeRoot).pathname,
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
