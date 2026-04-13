/**
 * Electron preload script.
 *
 * Runs in an isolated context before the renderer page loads.
 * Bridges the typed IPC API and push events to the renderer via contextBridge.
 *
 * IMPORTANT: This file must ONLY use '@ozymandros/electron-message-bridge/preload'.
 * Never import '@ozymandros/electron-message-bridge' (main entry) here.
 */

import { app } from 'electron';
import {
  exposeApiToRenderer,
  exposeEventsToRenderer,
  exposeValues,
} from '@ozymandros/electron-message-bridge/preload';
import { api }    from './api.';
import { events } from './events.';

// ── window.api ──────────────────────────────────────────────────────────────
// Typed request/response methods — renderer calls these like normal functions.
exposeApiToRenderer(api);

// ── window.events ───────────────────────────────────────────────────────────
// Typed push-event subscriptions — renderer subscribes and gets an unsub fn.
exposeEventsToRenderer(events);

// ── window.meta ─────────────────────────────────────────────────────────────
// Static read-only constants — no Node.js globals leak to the renderer.
exposeValues(
  {
    platform:    process.platform,
    appVersion:  app.getVersion(),
    nodeVersion: process.versions.node,
  },
  'meta',
);
