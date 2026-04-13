// vitest.config.ts
import { defineConfig } from "vitest/config";
var __vite_injected_original_import_meta_url = "file:///sessions/beautiful-clever-johnson/mnt/ozymandros/electron-message-bridge/vitest.config.ts";
var vitest_config_default = defineConfig({
  test: {
    environment: "node",
    // Maps bare 'electron' imports to our mock during tests.
    // Also maps the adapter package and peer dep references to their workspace
    // sources so both core shim tests and adapter package tests resolve correctly.
    alias: {
      electron: new URL("./tests/__mocks__/electron.ts", __vite_injected_original_import_meta_url).pathname,
      "@ozymandros/electron-message-bridge/adapter-assemblyscript": new URL(
        "./packages/adapter-assemblyscript/src/index.ts",
        __vite_injected_original_import_meta_url
      ).pathname,
      "@ozymandros/electron-message-bridge/adapter-named-pipe": new URL(
        "./packages/adapter-named-pipe/src/index.ts",
        __vite_injected_original_import_meta_url
      ).pathname,
      "@ozymandros/electron-message-bridge/adapter-grpc": new URL(
        "./packages/adapter-grpc/src/index.ts",
        __vite_injected_original_import_meta_url
      ).pathname,
      "@ozymandros/electron-message-bridge/adapter-stdio": new URL(
        "./packages/adapter-stdio/src/index.ts",
        __vite_injected_original_import_meta_url
      ).pathname,
      // When the adapter package tests import peer deps (ozymandros/electron-message-bridge,
      // ozymandros/electron-message-bridge/plugins) resolve to workspace source directly.
      "ozymandros/electron-message-bridge/plugins": new URL("./src/plugins.ts", __vite_injected_original_import_meta_url).pathname,
      "ozymandros/electron-message-bridge/transport": new URL("./src/transport.ts", __vite_injected_original_import_meta_url).pathname,
      "ozymandros/electron-message-bridge/boundary": new URL("./src/boundary.ts", __vite_injected_original_import_meta_url).pathname,
      "ozymandros/electron-message-bridge": new URL("./src/index.ts", __vite_injected_original_import_meta_url).pathname
    },
    typecheck: {
      tsconfig: "./tsconfig.typecheck.json"
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/types.ts"],
      reporter: ["text", "html"],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80
      }
    }
  }
});
export {
  vitest_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZXN0LmNvbmZpZy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9zZXNzaW9ucy9iZWF1dGlmdWwtY2xldmVyLWpvaG5zb24vbW50L2VsZWN0cm9uLWlwYy1oZWxwZXJcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9zZXNzaW9ucy9iZWF1dGlmdWwtY2xldmVyLWpvaG5zb24vbW50L2VsZWN0cm9uLWlwYy1oZWxwZXIvdml0ZXN0LmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vc2Vzc2lvbnMvYmVhdXRpZnVsLWNsZXZlci1qb2huc29uL21udC9lbGVjdHJvbi1pcGMtaGVscGVyL3ZpdGVzdC5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlc3QvY29uZmlnJztcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgdGVzdDoge1xuICAgIGVudmlyb25tZW50OiAnbm9kZScsXG4gICAgLy8gTWFwcyBiYXJlICdlbGVjdHJvbicgaW1wb3J0cyB0byBvdXIgbW9jayBkdXJpbmcgdGVzdHMuXG4gICAgLy8gQWxzbyBtYXBzIHRoZSBhZGFwdGVyIHBhY2thZ2UgYW5kIHBlZXIgZGVwIHJlZmVyZW5jZXMgdG8gdGhlaXIgd29ya3NwYWNlXG4gICAgLy8gc291cmNlcyBzbyBib3RoIGNvcmUgc2hpbSB0ZXN0cyBhbmQgYWRhcHRlciBwYWNrYWdlIHRlc3RzIHJlc29sdmUgY29ycmVjdGx5LlxuICAgIGFsaWFzOiB7XG4gICAgICBlbGVjdHJvbjogbmV3IFVSTCgnLi90ZXN0cy9fX21vY2tzX18vZWxlY3Ryb24udHMnLCBpbXBvcnQubWV0YS51cmwpLnBhdGhuYW1lLFxuICAgICAgJ0BlbGVjdHJvbi1pcGMtaGVscGVyL2FkYXB0ZXItYXNzZW1ibHlzY3JpcHQnOiBuZXcgVVJMKFxuICAgICAgICAnLi9wYWNrYWdlcy9hZGFwdGVyLWFzc2VtYmx5c2NyaXB0L3NyYy9pbmRleC50cycsXG4gICAgICAgIGltcG9ydC5tZXRhLnVybCxcbiAgICAgICkucGF0aG5hbWUsXG4gICAgICAnQGVsZWN0cm9uLWlwYy1oZWxwZXIvYWRhcHRlci1uYW1lZC1waXBlJzogbmV3IFVSTChcbiAgICAgICAgJy4vcGFja2FnZXMvYWRhcHRlci1uYW1lZC1waXBlL3NyYy9pbmRleC50cycsXG4gICAgICAgIGltcG9ydC5tZXRhLnVybCxcbiAgICAgICkucGF0aG5hbWUsXG4gICAgICAnQGVsZWN0cm9uLWlwYy1oZWxwZXIvYWRhcHRlci1ncnBjJzogbmV3IFVSTChcbiAgICAgICAgJy4vcGFja2FnZXMvYWRhcHRlci1ncnBjL3NyYy9pbmRleC50cycsXG4gICAgICAgIGltcG9ydC5tZXRhLnVybCxcbiAgICAgICkucGF0aG5hbWUsXG4gICAgICAnQGVsZWN0cm9uLWlwYy1oZWxwZXIvYWRhcHRlci1zdGRpbyc6IG5ldyBVUkwoXG4gICAgICAgICcuL3BhY2thZ2VzL2FkYXB0ZXItc3RkaW8vc3JjL2luZGV4LnRzJyxcbiAgICAgICAgaW1wb3J0Lm1ldGEudXJsLFxuICAgICAgKS5wYXRobmFtZSxcbiAgICAgIC8vIFdoZW4gdGhlIGFkYXB0ZXIgcGFja2FnZSB0ZXN0cyBpbXBvcnQgcGVlciBkZXBzIChlbGVjdHJvbi1pcGMtaGVscGVyLFxuICAgICAgLy8gZWxlY3Ryb24taXBjLWhlbHBlci9wbHVnaW5zKSByZXNvbHZlIHRvIHdvcmtzcGFjZSBzb3VyY2UgZGlyZWN0bHkuXG4gICAgICAnZWxlY3Ryb24taXBjLWhlbHBlci9wbHVnaW5zJzogbmV3IFVSTCgnLi9zcmMvcGx1Z2lucy50cycsIGltcG9ydC5tZXRhLnVybCkucGF0aG5hbWUsXG4gICAgICAnZWxlY3Ryb24taXBjLWhlbHBlci90cmFuc3BvcnQnOiBuZXcgVVJMKCcuL3NyYy90cmFuc3BvcnQudHMnLCBpbXBvcnQubWV0YS51cmwpLnBhdGhuYW1lLFxuICAgICAgJ2VsZWN0cm9uLWlwYy1oZWxwZXIvYm91bmRhcnknOiBuZXcgVVJMKCcuL3NyYy9ib3VuZGFyeS50cycsIGltcG9ydC5tZXRhLnVybCkucGF0aG5hbWUsXG4gICAgICAnZWxlY3Ryb24taXBjLWhlbHBlcic6IG5ldyBVUkwoJy4vc3JjL2luZGV4LnRzJywgaW1wb3J0Lm1ldGEudXJsKS5wYXRobmFtZSxcbiAgICB9LFxuICAgIHR5cGVjaGVjazoge1xuICAgICAgdHNjb25maWc6ICcuL3RzY29uZmlnLnR5cGVjaGVjay5qc29uJyxcbiAgICB9LFxuICAgIGNvdmVyYWdlOiB7XG4gICAgICBwcm92aWRlcjogJ3Y4JyxcbiAgICAgIGluY2x1ZGU6IFsnc3JjLyoqLyoudHMnXSxcbiAgICAgIGV4Y2x1ZGU6IFsnc3JjL3R5cGVzLnRzJ10sXG4gICAgICByZXBvcnRlcjogWyd0ZXh0JywgJ2h0bWwnXSxcbiAgICAgIHRocmVzaG9sZHM6IHtcbiAgICAgICAgc3RhdGVtZW50czogODAsXG4gICAgICAgIGJyYW5jaGVzOiA4MCxcbiAgICAgICAgZnVuY3Rpb25zOiA4MCxcbiAgICAgICAgbGluZXM6IDgwLFxuICAgICAgfSxcbiAgICB9LFxuICB9LFxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQW9XLFNBQVMsb0JBQW9CO0FBQW5LLElBQU0sMkNBQTJDO0FBRS9RLElBQU8sd0JBQVEsYUFBYTtBQUFBLEVBQzFCLE1BQU07QUFBQSxJQUNKLGFBQWE7QUFBQTtBQUFBO0FBQUE7QUFBQSxJQUliLE9BQU87QUFBQSxNQUNMLFVBQVUsSUFBSSxJQUFJLGlDQUFpQyx3Q0FBZSxFQUFFO0FBQUEsTUFDcEUsK0NBQStDLElBQUk7QUFBQSxRQUNqRDtBQUFBLFFBQ0E7QUFBQSxNQUNGLEVBQUU7QUFBQSxNQUNGLDJDQUEyQyxJQUFJO0FBQUEsUUFDN0M7QUFBQSxRQUNBO0FBQUEsTUFDRixFQUFFO0FBQUEsTUFDRixxQ0FBcUMsSUFBSTtBQUFBLFFBQ3ZDO0FBQUEsUUFDQTtBQUFBLE1BQ0YsRUFBRTtBQUFBLE1BQ0Ysc0NBQXNDLElBQUk7QUFBQSxRQUN4QztBQUFBLFFBQ0E7QUFBQSxNQUNGLEVBQUU7QUFBQTtBQUFBO0FBQUEsTUFHRiwrQkFBK0IsSUFBSSxJQUFJLG9CQUFvQix3Q0FBZSxFQUFFO0FBQUEsTUFDNUUsaUNBQWlDLElBQUksSUFBSSxzQkFBc0Isd0NBQWUsRUFBRTtBQUFBLE1BQ2hGLGdDQUFnQyxJQUFJLElBQUkscUJBQXFCLHdDQUFlLEVBQUU7QUFBQSxNQUM5RSx1QkFBdUIsSUFBSSxJQUFJLGtCQUFrQix3Q0FBZSxFQUFFO0FBQUEsSUFDcEU7QUFBQSxJQUNBLFdBQVc7QUFBQSxNQUNULFVBQVU7QUFBQSxJQUNaO0FBQUEsSUFDQSxVQUFVO0FBQUEsTUFDUixVQUFVO0FBQUEsTUFDVixTQUFTLENBQUMsYUFBYTtBQUFBLE1BQ3ZCLFNBQVMsQ0FBQyxjQUFjO0FBQUEsTUFDeEIsVUFBVSxDQUFDLFFBQVEsTUFBTTtBQUFBLE1BQ3pCLFlBQVk7QUFBQSxRQUNWLFlBQVk7QUFBQSxRQUNaLFVBQVU7QUFBQSxRQUNWLFdBQVc7QUFBQSxRQUNYLE9BQU87QUFBQSxNQUNUO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
