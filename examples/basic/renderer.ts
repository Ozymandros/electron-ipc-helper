/**
 * Example renderer process code.
 *
 * No IPC boilerplate. No ipcRenderer. No channel strings.
 * Just fully-typed function calls.
 *
 * Assumes this file is loaded after the preload has run and
 * `window.api`, `window.events`, and `window.meta` are available.
 */

/// <reference path="./renderer.d.ts" />

// ─── Static constants (no async needed) ──────────────────────────────────────

console.log('Platform:   ', window.meta.platform);
console.log('App version:', window.meta.appVersion);
console.log('Node:       ', window.meta.nodeVersion);

// ─── Request / response calls ─────────────────────────────────────────────────

async function loadUser(id: string): Promise<void> {
  // Return type is inferred as Promise<{ id: string; name: string; email: string }>
  const user = await window.api.getUser(id);
  console.log('User:', user.name, user.email);
}

async function saveTheme(theme: 'dark' | 'light'): Promise<void> {
  // TypeScript enforces the correct shape — no need to remember channel names
  await window.api.saveSettings({ theme, fontSize: 14 });
  console.log('Settings saved');
}

async function checkConnection(): Promise<void> {
  const result = await window.api.ping();
  //    ^? 'pong'  — literal type preserved end-to-end
  console.log('Health check:', result);
}

// ─── Push-event subscriptions ─────────────────────────────────────────────────

// Subscribe — returns an unsubscribe function for cleanup
const unsubReady = window.events.backendReady((code) => {
  //                                            ^? number — type inferred
  console.log('Backend ready, exit code:', code);
});

const unsubFolder = window.events.folderSelected((path) => {
  //                                               ^? string
  console.log('Folder selected:', path);
});

const unsubCrash = window.events.backendCrashed((code, signal) => {
  //                                              ^? number | null, string | null
  console.error('Backend crashed — code:', code, 'signal:', signal);
});

// ─── Example: run on page load ────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', async () => {
  await checkConnection();
  await loadUser('42');
  await saveTheme('dark');
});

// ─── Cleanup on unload ────────────────────────────────────────────────────────

window.addEventListener('beforeunload', () => {
  unsubReady();
  unsubFolder();
  unsubCrash();
});
