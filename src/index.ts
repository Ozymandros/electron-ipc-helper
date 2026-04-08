/**
 * electron-ipc-helper — main process entry point
 *
 * A small, typed, zero-boilerplate Electron IPC helper.
 * Abstracts all IPC setup for the main process, preload, and renderer.
 *
 * ┌──────────────────────────────────┬──────────────────────────────────────┐
 * │  Import path                     │  Use in                              │
 * ├──────────────────────────────────┼──────────────────────────────────────┤
 * │  'electron-ipc-helper'           │  Main process                        │
 * │  'electron-ipc-helper/preload'   │  Preload script                      │
 * └──────────────────────────────────┴──────────────────────────────────────┘
 *
 * @see https://github.com/your-org/electron-ipc-helper
 */

export {
  defineIpcApi,
  defineIpcEvents,
} from './main.js';

export {
  ChildProcessLifecycle,
} from './lifecycle.js';

export type {
  ChildProcessLifecycleEvents,
  ChildProcessLifecycleOptions,
  ProcessExitInfo,
} from './lifecycle.js';

export type {
  ActionDescriptor,
  ActionRegistry,
  ApiHandlers,
  AsyncFn,
  CommandActionDescriptor,
  EmitActionDescriptor,
  EventHandler,
  EventsSchema,
  ExtractRendererApi,
  ExtractRendererEvents,
  IpcApi,
  IpcEvents,
  RendererApi,
  RendererEvents,
  ServiceActionDescriptor,
  WindowTarget,
} from './types.js';
