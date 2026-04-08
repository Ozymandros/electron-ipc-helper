/**
 * @module integrations
 *
 * Optional Electron feature integrations that are built on top of core IPC
 * transport primitives.
 *
 * Import from `electron-ipc-helper/integrations` when you want ready-made
 * wrappers for common Electron APIs such as dialogs and shell operations.
 */

import { contextBridge, dialog, ipcMain, ipcRenderer, shell } from "electron";

/** Disposable registration returned by built-in IPC registrars. */
export interface IpcRegistration {
  dispose(): void;
}

/**
 * Renderer-facing API exposed by `exposeDialogsToRenderer`.
 */
export interface DialogsRendererApi {
  /** Opens a file picker and returns the selected path or `null`. */
  openFile(options?: unknown): Promise<string | null>;
  /** Opens a directory picker and returns the selected path or `null`. */
  openDirectory(options?: unknown): Promise<string | null>;
  /** Opens a save dialog and returns the chosen file path or `null`. */
  saveFile(options?: unknown): Promise<string | null>;
  /** Opens a message box and returns the clicked button index. */
  messageBox(options: unknown): Promise<number>;
}

/**
 * Renderer-facing API exposed by `exposeShellToRenderer`.
 */
export interface ShellRendererApi {
  /** Opens an external URL in the system browser. */
  openExternal(url: string): Promise<void>;
  /** Opens a file or directory path with the system shell. */
  openPath(path: string): Promise<string>;
}

// ─── Main-process registrars ─────────────────────────────────────────────────

/**
 * Registers a standard dialog IPC surface in the main process.
 *
 * Channels:
 * - `${channelPrefix}:open-file`
 * - `${channelPrefix}:open-directory`
 * - `${channelPrefix}:save-file`
 * - `${channelPrefix}:message-box`
 */
export function registerDialogHandlers(
  channelPrefix = "dialog",
): IpcRegistration {
  const openFileChannel = `${channelPrefix}:open-file`;
  const openDirectoryChannel = `${channelPrefix}:open-directory`;
  const saveFileChannel = `${channelPrefix}:save-file`;
  const messageBoxChannel = `${channelPrefix}:message-box`;

  ipcMain.handle(
    openFileChannel,
    async (_event, options?: Record<string, unknown>) => {
      const result = await dialog.showOpenDialog({
        ...options,
        properties: ["openFile"],
      });
      return result.canceled ? null : (result.filePaths[0] ?? null);
    },
  );

  ipcMain.handle(
    openDirectoryChannel,
    async (_event, options?: Record<string, unknown>) => {
      const result = await dialog.showOpenDialog({
        ...options,
        properties: ["openDirectory"],
      });
      return result.canceled ? null : (result.filePaths[0] ?? null);
    },
  );

  ipcMain.handle(
    saveFileChannel,
    async (_event, options?: Record<string, unknown>) => {
      const result = await dialog.showSaveDialog(options ?? {});
      return result.canceled ? null : (result.filePath ?? null);
    },
  );

  ipcMain.handle(messageBoxChannel, async (_event, options: unknown) => {
    if (
      typeof options !== "object" ||
      options === null ||
      typeof (options as { message?: unknown }).message !== "string"
    ) {
      throw new TypeError(
        `[electron-ipc-helper] ${messageBoxChannel} requires an options object with a string \"message\" property.`,
      );
    }

    const result = await dialog.showMessageBox(
      options as { message: string } & Record<string, unknown>,
    );
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

/**
 * Registers a standard shell IPC surface in the main process.
 *
 * Channels:
 * - `${channelPrefix}:open-external`
 * - `${channelPrefix}:open-path`
 */
export function registerShellHandlers(
  channelPrefix = "shell",
): IpcRegistration {
  const openExternalChannel = `${channelPrefix}:open-external`;
  const openPathChannel = `${channelPrefix}:open-path`;

  ipcMain.handle(openExternalChannel, async (_event, url: string) => {
    await shell.openExternal(url);
  });

  ipcMain.handle(openPathChannel, async (_event, path: string) =>
    shell.openPath(path),
  );

  return {
    dispose(): void {
      ipcMain.removeHandler(openExternalChannel);
      ipcMain.removeHandler(openPathChannel);
    },
  };
}

// ─── Preload exposers ────────────────────────────────────────────────────────

/**
 * Exposes a standard dialogs API to the renderer.
 *
 * @param key           - Window key used for exposure. Defaults to `dialogs`.
 * @param channelPrefix - Channel prefix used by main handlers. Defaults to `dialog`.
 */
export function exposeDialogsToRenderer(
  key = "dialogs",
  channelPrefix = "dialog",
): void {
  const api: DialogsRendererApi = {
    openFile: (options?: unknown) =>
      ipcRenderer.invoke(`${channelPrefix}:open-file`, options),
    openDirectory: (options?: unknown) =>
      ipcRenderer.invoke(`${channelPrefix}:open-directory`, options),
    saveFile: (options?: unknown) =>
      ipcRenderer.invoke(`${channelPrefix}:save-file`, options),
    messageBox: (options: unknown) =>
      ipcRenderer.invoke(`${channelPrefix}:message-box`, options),
  };

  contextBridge.exposeInMainWorld(key, api);
}

/**
 * Exposes a standard shell API to the renderer.
 *
 * @param key           - Window key used for exposure. Defaults to `shell`.
 * @param channelPrefix - Channel prefix used by main handlers. Defaults to `shell`.
 */
export function exposeShellToRenderer(
  key = "shell",
  channelPrefix = "shell",
): void {
  const api: ShellRendererApi = {
    openExternal: (url: string) =>
      ipcRenderer.invoke(`${channelPrefix}:open-external`, url),
    openPath: (path: string) =>
      ipcRenderer.invoke(`${channelPrefix}:open-path`, path),
  };

  contextBridge.exposeInMainWorld(key, api);
}

