// Defensive runtime shim for Vite SSR CJS interop helper used in some transforms.
if (!(globalThis as { __vite_ssr_exportName__?: unknown }).__vite_ssr_exportName__) {
  (globalThis as unknown as { __vite_ssr_exportName__: (target: unknown, name: string) => string })
    .__vite_ssr_exportName__ = (_target: unknown, name: string) => name;
}
