/**
 * Electron main process entry point.
 *
 * Imports the api and events handles (which triggers handler registration
 * because ipcMain is available in this context) and sets up BrowserWindow.
 */

import { app, BrowserWindow, dialog } from 'electron';
import path from 'node:path';
import { api } from './api.';
import { events } from './events.';

// ─── Keep a reference to the window ──────────────────────────────────────────

let mainWindow: BrowserWindow | null = null;

// ─── Window factory ───────────────────────────────────────────────────────────

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      // Required for contextBridge — never disable this
      contextIsolation: true,
      // Recommended for security — our preload works with sandbox enabled
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // ── Demonstrate push events ──────────────────────────────────────────────
  mainWindow.webContents.on('did-finish-load', () => {
    // Signal the renderer that the backend is ready
    events.emit(mainWindow!, 'backendReady', 0);
  });
}

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // On macOS, apps conventionally stay open until ⌘Q
  if (process.platform !== 'darwin') app.quit();
});

// ─── Native dialog integration ───────────────────────────────────────────────

// Override the placeholder getUser handler to use real data (illustrative)
// In practice, define real handlers directly in api.ts
void api;         // api is already registered — reference suppresses lint warning
void events;      // same for events

// Example: trigger folder selection and push the result to the renderer
app.on('open-file', (_event, filePath) => {
  if (mainWindow) {
    events.emit(mainWindow, 'folderSelected', filePath);
  }
});

// ─── Hot-reload support (Vite / electron-vite) ───────────────────────────────

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    // Remove all IPC handlers before the module is replaced so HMR
    // does not produce "duplicate handler" errors on reload.
    api.dispose();
  });
}
