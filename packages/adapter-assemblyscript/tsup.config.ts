import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
  },
  format: ['esm', 'cjs'],
  outExtension: ({ format }) => ({ js: format === 'esm' ? '.mjs' : '.cjs' }),
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  // electron and @ozymandros/electron-message-bridge are always externals — never bundle them
  external: ['electron', '@ozymandros/electron-message-bridge'],
});
