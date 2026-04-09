/**
 * @module main
 *
 * Main-process entry point for electron-message-bridge.
 *
 * Import this module **only** from your Electron main process.
 *
 * - `defineIpcApi`    — register typed request/response handlers
 * - `defineIpcEvents` — declare typed push events (main → renderer)
 *
 * @example
 * ```ts
 * // src-electron/api.ts
 * import { defineIpcApi } from 'electron-message-bridge';
 *
 * export const api = defineIpcApi({
 *   getUser:      async (id: string)       => db.users.findById(id),
 *   saveSettings: async (s: UserSettings)  => db.settings.save(s),
 * });
 * ```
 */

import { ipcMain } from 'electron';
import { InvalidPayloadError } from './errors.js';
import type { ApiHandlers, EventsSchema, IpcApi, IpcEvents, WindowTarget } from './types';

// ─── defineIpcApi ─────────────────────────────────────────────────────────────

/**
 * Defines the IPC API in the main process.
 *
 * - Derives the complete set of channel names from the handler object keys.
 * - Registers each handler with `ipcMain.handle` automatically.
 * - Returns a typed `IpcApi<T>` handle to be passed to `exposeApiToRenderer`
 *   in the preload script.
 *
 * ### Safety
 * - Channel names are derived exclusively from the handler object keys.
 *   No arbitrary or dynamic channel strings are possible.
 * - The `_event` argument from Electron is never forwarded to handlers,
 *   preventing accidental access to the sender `WebContents`.
 * - Errors thrown by handlers are automatically propagated to the renderer
 *   as rejected promises.
 * - The `_channels` array is frozen immediately after creation.
 *
 * @param handlers - A plain object whose values are async functions.
 * @returns An `IpcApi<T>` handle carrying the handler types.
 *
 * @example
 * ```ts
 * export const api = defineIpcApi({
 *   ping:         async ()                 => 'pong' as const,
 *   getUser:      async (id: string)       => db.users.findById(id),
 *   saveSettings: async (s: UserSettings)  => db.settings.save(s),
 * });
 * ```
 */
export function defineIpcApi<T extends ApiHandlers>(handlers: T): IpcApi<T> {
  const channels = Object.keys(handlers) as Array<keyof T & string>;

  for (const channel of channels) {
    const handler = handlers[channel];

    if (typeof handler !== 'function') {
      throw new InvalidPayloadError(channel);
    }

    ipcMain.handle(channel, (_event, ...args: unknown[]) => handler(...args));
  }

  Object.freeze(channels);

  return {
    _channels: channels,
    dispose(): void {
      for (const channel of channels) {
        ipcMain.removeHandler(channel);
      }
    },
  } as unknown as IpcApi<T>;
}

// ─── defineIpcEvents ──────────────────────────────────────────────────────────

/**
 * Declares a set of typed push events to be sent from the main process
 * to a renderer window.
 *
 * Schema values are **descriptor functions** — their parameter signatures
 * define the event payload types. The function bodies are never executed.
 *
 * Returns an `IpcEvents<T>` handle with a type-safe `emit` method.
 * Pass this handle to `exposeEventsToRenderer` in the preload script so the
 * renderer can subscribe to these events.
 *
 * @param schema - An object of named descriptor functions.
 * @returns An `IpcEvents<T>` handle.
 *
 * @example
 * ```ts
 * export const events = defineIpcEvents({
 *   backendReady:   (_code: number)                             => {},
 *   folderSelected: (_path: string)                             => {},
 *   backendCrashed: (_code: number | null, _sig: string | null) => {},
 * });
 *
 * // Later, send an event to a window:
 * events.emit(browserWindow, 'backendReady', 0);
 * ```
 */
export function defineIpcEvents<T extends EventsSchema>(schema: T): IpcEvents<T> {
  const channels = Object.keys(schema) as Array<keyof T & string>;
  Object.freeze(channels);

  return {
    _channels: channels,
    emit<K extends keyof T & string>(
      target: WindowTarget,
      channel: K,
      ...args: Parameters<T[K]>
    ): void {
      target.webContents.send(channel, ...(args as unknown[]));
    },
  } as unknown as IpcEvents<T>;
}

// Compatibility re-exports for editor/consumer migrations.
export {
  registerDialogHandlers,
  registerShellHandlers,
} from './integrations';

