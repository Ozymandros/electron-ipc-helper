# ADR-001: Module Boundary Strategy

**Status:** Accepted  
**Date:** 2026-04-08  
**Deciders:** Core maintainers

---

## Context

Electron apps require code to run in three separate contexts with strict boundaries:

1. **Main process** — Node.js, full OS access, no DOM.
2. **Preload script** — Node.js + limited DOM, runs in isolated context before renderer.
3. **Renderer process** — Chromium, sandboxed, no direct Node.js access.

Sharing a single entry point (`import 'electron-message-bridge'`) for all three contexts is dangerous: importing `ipcMain` in the renderer crashes; importing `contextBridge` in the main process has no effect; bundling all code together bloats renderer bundles.

---

## Decision

Expose separate entry points per context, enforced via `package.json` `"exports"`:

| Entry point | Context | Key exports |
|---|---|---|
| `electron-message-bridge` | Main process | `defineIpcApi`, `defineIpcEvents`, `ChildProcessLifecycle` |
| `electron-message-bridge/preload` | Preload script | `exposeApiToRenderer`, `exposeEventsToRenderer`, `exposeValues` |
| `electron-message-bridge/integrations` | Main process | `registerDialogHandlers`, `registerShellHandlers` |
| `electron-message-bridge/menus` | Main process | `buildMenuTemplate`, `applyApplicationMenuFromFile` |
| `electron-message-bridge/appkit` | Main process | `createMainAppKit` |
| `electron-message-bridge/lifecycle` | Main process | `ChildProcessLifecycle` |

Type definitions are co-located in each entry's `.d.ts` file. Shared types (`ApiHandlers`, `IpcApi`, etc.) are exported from the main entry and re-exported from `electron-message-bridge/preload` for convenience.

---

## Consequences

**Positive:**
- Bundlers tree-shake correctly. Renderer bundles never include `ipcMain`.
- TypeScript import paths communicate intent clearly.
- Each entry point can evolve its stability level independently.

**Negative:**
- Users must import from the correct entry point. Mistakes cause runtime errors that are hard to diagnose without good error messages.
- More entry points to maintain and test.

**Mitigations:**
- Each module has a JSDoc `@module` note at the top explaining where to import it.
- Runtime guards (`if (typeof ipcMain === 'undefined') throw`) are added where feasible.
