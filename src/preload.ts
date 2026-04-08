/**
 * @module preload
 *
 * Preload-script entry point for electron-ipc-helper.
 *
 * Import this module **only** from your Electron preload script.
 *
 * - `exposeApiToRenderer`    — bridge request/response API to the renderer
 * - `exposeEventsToRenderer` — bridge push-event subscriptions to the renderer
 * - `exposeValues`           — expose static serialisable constants
 *
 * @example
 * ```ts
 * // preload.ts
 * import { exposeApiToRenderer, exposeEventsToRenderer, exposeValues } from 'electron-ipc-helper/preload';
 * import { api }    from './api';
 * import { events } from './events';
 *
 * exposeApiToRenderer(api);
 * exposeEventsToRenderer(events);
 * exposeValues({ platform: process.platform }, 'meta');
 * ```
 */

import { contextBridge, ipcRenderer } from 'electron';
import type {
  ApiHandlers,
  EventsSchema,
  IpcApi,
  IpcEvents,
  RendererApi,
  RendererEvents,
} from './types';

// ─── exposeApiToRenderer ──────────────────────────────────────────────────────

/**
 * Exposes the typed request/response API to the renderer process.
 *
 * Must be called from the **preload script**. Uses
 * `contextBridge.exposeInMainWorld` to safely bridge calls from the renderer
 * to the main process via `ipcRenderer.invoke`, without leaking `ipcRenderer`
 * or any Electron internals.
 *
 * ### Safety guarantees
 * - `ipcRenderer` is never exposed to the renderer.
 * - Only the channels declared in the `IpcApi` handle can be invoked.
 * - Works with `contextIsolation: true` and `sandbox: true`.
 *
 * @param api - The `IpcApi<T>` handle returned by `defineIpcApi`.
 * @param key - The property key under which the API is mounted on `window`.
 *              Defaults to `'api'`, producing `window.api`.
 *
 * @example
 * ```ts
 * exposeApiToRenderer(api);           // → window.api
 * exposeApiToRenderer(api, 'myApp'); // → window.myApp
 * ```
 */
export function exposeApiToRenderer<T extends ApiHandlers>(
  api: IpcApi<T>,
  key = 'api',
): void {
  const exposed = Object.fromEntries(
    api._channels.map((channel) => [
      channel,
      (...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
    ]),
  ) as RendererApi<T>;

  contextBridge.exposeInMainWorld(key, exposed);
}

// ─── exposeEventsToRenderer ───────────────────────────────────────────────────

/**
 * Exposes typed push-event subscription functions to the renderer.
 *
 * Each exposed function accepts a callback and returns an **unsubscribe**
 * function. The `IpcRendererEvent` injected by Electron is stripped before
 * the callback receives its arguments.
 *
 * Must be called from the **preload script**.
 *
 * ### Safety guarantees
 * - `ipcRenderer` is never exposed to the renderer.
 * - Only the channels declared in the `IpcEvents` handle are accessible.
 * - Every subscription returns a cleanup function — no orphaned listeners.
 *
 * @param events - The `IpcEvents<T>` handle returned by `defineIpcEvents`.
 * @param key    - The property key under which subscriptions are mounted on `window`.
 *                 Defaults to `'events'`, producing `window.events`.
 *
 * @example
 * ```ts
 * exposeEventsToRenderer(events);            // → window.events
 * exposeEventsToRenderer(events, 'notify'); // → window.notify
 * ```
 */
export function exposeEventsToRenderer<T extends EventsSchema>(
  events: IpcEvents<T>,
  key = 'events',
): void {
  const exposed = Object.fromEntries(
    events._channels.map((channel) => [
      channel,
      (callback: (...args: unknown[]) => void): (() => void) => {
        // Strip the IpcRendererEvent (first arg) before forwarding to the callback.
        const listener = (_event: unknown, ...args: unknown[]) => callback(...args);
        ipcRenderer.on(channel, listener);
        return () => ipcRenderer.removeListener(channel, listener);
      },
    ]),
  ) as RendererEvents<T>;

  contextBridge.exposeInMainWorld(key, exposed);
}

// ─── exposeValues ─────────────────────────────────────────────────────────────

/**
 * Exposes a plain object of static serialisable values to the renderer via
 * `contextBridge.exposeInMainWorld`.
 *
 * Use this for constants that should be available in the renderer without
 * requiring an IPC round-trip and without leaking any Node.js globals.
 *
 * @param values - A plain, serialisable object.
 * @param key    - The property key under which values are mounted on `window`.
 *
 * @example
 * ```ts
 * exposeValues({ platform: process.platform, version: app.getVersion() }, 'meta');
 * // Renderer: window.meta.platform, window.meta.version
 * ```
 */
export function exposeValues<T extends Record<string, unknown>>(
  values: T,
  key: string,
): void {
  contextBridge.exposeInMainWorld(key, values);
}

// Compatibility re-exports for editor/consumer migrations.
export {
  exposeDialogsToRenderer,
  exposeShellToRenderer,
} from './integrations';

// ─── Re-exports ───────────────────────────────────────────────────────────────

// Re-export all shared types so preload files need only one import source.
export type {
  ApiHandlers,
  AsyncFn,
  EventHandler,
  EventsSchema,
  ExtractRendererApi,
  ExtractRendererEvents,
  IpcApi,
  IpcEvents,
  RendererApi,
  RendererEvents,
  WindowTarget,
} from './types.js';
