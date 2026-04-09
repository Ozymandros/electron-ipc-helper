// Defensive runtime shim for Vite SSR CJS interop helper used in some transforms.
type ViteSsrExportNameFn = (target: unknown, name: string) => unknown;

const g = globalThis as unknown as {
  __vite_ssr_exportName__?: unknown;
};

// Always override so CI/runtime differences cannot keep a broken helper.
(g as { __vite_ssr_exportName__: ViteSsrExportNameFn }).__vite_ssr_exportName__ = (
  target: unknown,
  name: string,
) => {
  if (target !== null && typeof target === 'object') {
    const obj = target as Record<string, unknown>;
    if (name in obj) return obj[name];

    const def = obj.default;
    if (def !== null && typeof def === 'object' && name in (def as Record<string, unknown>)) {
      return (def as Record<string, unknown>)[name];
    }
  }
  return undefined;
};
