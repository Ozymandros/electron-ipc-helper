/**
 * @module main
 *
 * Main-process entry point for electron-ipc-helper.
 *
 * Import this module **only** from your Electron main process.
 *
 * - `defineIpcApi`    — register typed request/response handlers
 * - `defineIpcEvents` — declare typed push events (main → renderer)
 *
 * @example
 * ```ts
 * // src-electron/api.ts
 * import { defineIpcApi } from 'electron-ipc-helper';
 *
 * export const api = defineIpcApi({
 *   getUser:      async (id: string)       => db.users.findById(id),
 *   saveSettings: async (s: UserSettings)  => db.settings.save(s),
 * });
 * ```
 */

import { dialog, ipcMain, shell } from 'electron';
import type { ApiHandlers, EventsSchema, IpcApi, IpcEvents, WindowTarget } from './types.js';

/** Disposable registration returned by built-in IPC registrars. */
export interface IpcRegistration {
  dispose(): void;
}

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
      throw new TypeError(
        `[electron-ipc-helper] Handler for channel "${channel}" must be a function.`,
      );
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

// ─── registerDialogHandlers ──────────────────────────────────────────────────

/**
 * Registers a standard dialog IPC surface in the main process.
 *
 * Channels:
 * - `${channelPrefix}:open-file`
 * - `${channelPrefix}:open-directory`
 * - `${channelPrefix}:save-file`
 * - `${channelPrefix}:message-box`
 *
 * @param channelPrefix - Prefix for all dialog channels. Defaults to `dialog`.
 */
export function registerDialogHandlers(channelPrefix = 'dialog'): IpcRegistration {
  const openFileChannel = `${channelPrefix}:open-file`;
  const openDirectoryChannel = `${channelPrefix}:open-directory`;
  const saveFileChannel = `${channelPrefix}:save-file`;
  const messageBoxChannel = `${channelPrefix}:message-box`;

  ipcMain.handle(openFileChannel, async (_event, options?: Record<string, unknown>) => {
    const result = await dialog.showOpenDialog({
      ...options,
      properties: ['openFile'],
    });
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });

  ipcMain.handle(openDirectoryChannel, async (_event, options?: Record<string, unknown>) => {
    const result = await dialog.showOpenDialog({
      ...options,
      properties: ['openDirectory'],
    });
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });

  ipcMain.handle(saveFileChannel, async (_event, options?: Record<string, unknown>) => {
    const result = await dialog.showSaveDialog(options ?? {});
    return result.canceled ? null : (result.filePath ?? null);
  });

  ipcMain.handle(messageBoxChannel, async (_event, options: unknown) => {
    if (
      typeof options !== 'object'
      || options === null
      || typeof (options as { message?: unknown }).message !== 'string'
    ) {
      throw new TypeError(
        `[electron-ipc-helper] ${messageBoxChannel} requires an options object with a string \"message\" property.`,
      );
    }

    const result = await dialog.showMessageBox(options as { message: string } & Record<string, unknown>);
    return result.response;
  });

  return {
    dispose(): void {
      ipcMain.removeHandler(openFileChannel);
      ipcMain.removeHandler(openDirectoryChannel);
      ipcMain.removeHandler(saveFileChannel);
      ipcMain.removeHandler(messageBoxChannel);
    },
  };
}

// ─── registerShellHandlers ───────────────────────────────────────────────────

/**
 * Registers a standard shell IPC surface in the main process.
 *
 * Channels:
 * - `${channelPrefix}:open-external`
 * - `${channelPrefix}:open-path`
 *
 * @param channelPrefix - Prefix for all shell channels. Defaults to `shell`.
 */
export function registerShellHandlers(channelPrefix = 'shell'): IpcRegistration {
  const openExternalChannel = `${channelPrefix}:open-external`;
  const openPathChannel = `${channelPrefix}:open-path`;

  ipcMain.handle(openExternalChannel, async (_event, url: string) => {
    await shell.openExternal(url);
  });

  ipcMain.handle(openPathChannel, async (_event, path: string) => shell.openPath(path));

  return {
    dispose(): void {
      ipcMain.removeHandler(openExternalChannel);
      ipcMain.removeHandler(openPathChannel);
    },
  };
}
