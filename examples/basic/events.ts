/**
 * Shared push-event declaration — imported by both main.ts (for emitting)
 * and the preload script (for the channel list).
 *
 * Schema values are descriptor functions: their parameter signatures
 * define the event payload types. The bodies are never executed.
 */

import { defineIpcEvents } from 'electron-message-bridge';

export const events = defineIpcEvents({
  /**
   * Emitted when the backend is ready to accept requests.
   * Payload: exit code of the previous session (0 = clean start).
   */
  backendReady: (_code: number) => {},

  /**
   * Emitted when the user picks a folder via the native file dialog.
   * Payload: absolute path of the selected folder.
   */
  folderSelected: (_path: string) => {},

  /**
   * Emitted when the backend process crashes unexpectedly.
   * Payload: OS exit code and signal (either may be null).
   */
  backendCrashed: (_code: number | null, _signal: string | null) => {},
});
