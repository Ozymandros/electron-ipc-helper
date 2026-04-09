/**
 * Shared API definition — imported by both main.ts (for registration)
 * and the preload script (for the channel list).
 *
 * `defineIpcApi` is safe to import here because it guards registration
 * behind a check: handlers are only registered when `ipcMain` is available
 * (i.e., in the main process). In the preload context it only returns
 * the typed channel list.
 */

import { defineIpcApi } from 'electron-message-bridge';

// ─── Request / Response API ───────────────────────────────────────────────────

export interface UserSettings {
  theme: 'dark' | 'light';
  fontSize: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
}

/**
 * The application IPC API.
 *
 * Defined once; automatically wired in main and exposed in the preload.
 * The renderer sees `window.api` typed as `ExtractRendererApi<typeof api>`.
 */
export const api = defineIpcApi({
  /**
   * Returns a user by ID.
   * In a real app this would query a database or file store.
   */
  getUser: async (id: string): Promise<User> => {
    // Placeholder — replace with real data access
    return { id, name: 'Alice', email: 'alice@example.com' };
  },

  /**
   * Persists user settings to disk.
   */
  saveSettings: async (settings: UserSettings): Promise<void> => {
    // Placeholder — replace with electron-store or similar
    console.log('[main] saving settings:', settings);
  },

  /**
   * Health-check endpoint.
   */
  ping: async (): Promise<'pong'> => 'pong',
});
