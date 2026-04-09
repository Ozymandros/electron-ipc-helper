/**
 * @module types
 *
 * Core type definitions for electron-message-bridge.
 * All types are designed for strict end-to-end inference with no `any` leakage
 * at the call site.
 */

// ─── Primitives ───────────────────────────────────────────────────────────────

/** Any async function (the building block of an IPC handler). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AsyncFn = (...args: any[]) => Promise<any>;

/** A named map of async handler functions. */
export type ApiHandlers = Record<string, AsyncFn>;

/**
 * A descriptor function for a push event.
 * Its parameters define the event payload type.
 * The function body is never executed — it exists only for type inference.
 *
 * @example
 * ```ts
 * type MyEvent = EventHandler; // (_code: number, _msg: string) => void
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EventHandler = (...args: any[]) => void;

/** A named map of event descriptor functions. */
export type EventsSchema = Record<string, EventHandler>;

// ─── Type Mapping ─────────────────────────────────────────────────────────────

/**
 * Maps an `ApiHandlers` definition to its renderer-callable equivalent.
 *
 * Preserves all parameter types and return types exactly. The resulting type
 * is what `window.api` looks like in the renderer — a read-only mirror of the
 * main-process handlers, safe to call from the sandboxed renderer context.
 *
 * @example
 * ```ts
 * type Handlers = { getUser: (id: string) => Promise<User> };
 * type Api      = RendererApi<Handlers>;
 * // => { readonly getUser: (id: string) => Promise<User> }
 * ```
 */
export type RendererApi<T extends ApiHandlers> = {
  readonly [K in keyof T]: T[K] extends (...args: infer A) => Promise<infer R>
    ? (...args: A) => Promise<R>
    : never;
};

/**
 * Maps an `EventsSchema` definition to the renderer-callable subscription API.
 *
 * Each key becomes a function that accepts a callback and returns an
 * unsubscribe function. The renderer never has access to `ipcRenderer` itself.
 *
 * @example
 * ```ts
 * type Schema  = { backendReady: (code: number) => void };
 * type REvents = RendererEvents<Schema>;
 * // => { readonly backendReady: (cb: (code: number) => void) => () => void }
 * ```
 */
export type RendererEvents<T extends EventsSchema> = {
  readonly [K in keyof T]: T[K] extends (...args: infer A) => void
    ? (callback: (...args: A) => void) => () => void
    : never;
};

// ─── Window Target ────────────────────────────────────────────────────────────

/**
 * Minimal interface satisfied by Electron `BrowserWindow` (and any window-like
 * object with `webContents.send`). Using a structural interface instead of the
 * concrete Electron type keeps the library decoupled from the full Electron
 * typings at the call site.
 */
export interface WindowTarget {
  webContents: {
    send(channel: string, ...args: unknown[]): void;
  };
}

// ─── Opaque Handles ───────────────────────────────────────────────────────────

/** Unique brand symbols — prevent structural subtyping on opaque handles. */
declare const IpcApiBrand: unique symbol;
declare const IpcEventsBrand: unique symbol;

/**
 * Opaque typed handle returned by `defineIpcApi`.
 *
 * Carries the full handler type as a phantom parameter `T`, ensuring that
 * `exposeApiToRenderer` and `ExtractRendererApi` can reconstruct the exact
 * renderer-facing types without manual annotation.
 *
 * At runtime this is a plain object with a frozen `_channels` array and a
 * `dispose` method. The brand symbol exists only at the type level.
 */
export interface IpcApi<T extends ApiHandlers> {
  /** @internal Phantom brand — do not read or write at runtime. */
  readonly [IpcApiBrand]: T;
  /** @internal Frozen channel names registered in the main process. */
  readonly _channels: ReadonlyArray<keyof T & string>;
  /**
   * Removes all handlers registered by this API from `ipcMain`.
   * Idempotent — safe to call multiple times.
   * Useful for Vite/webpack HMR setups where modules are replaced at runtime.
   */
  dispose(): void;
}

/**
 * Opaque typed handle returned by `defineIpcEvents`.
 *
 * Carries the full event schema as a phantom parameter `T`.
 * Provides a type-safe `emit` method for pushing events to a renderer window.
 */
export interface IpcEvents<T extends EventsSchema> {
  /** @internal Phantom brand — do not read or write at runtime. */
  readonly [IpcEventsBrand]: T;
  /** @internal Frozen channel names declared in the schema. */
  readonly _channels: ReadonlyArray<keyof T & string>;
  /**
   * Sends a push event to the given `BrowserWindow`.
   * Arguments are fully type-checked against the schema descriptor.
   *
   * @param target  - Any object with `webContents.send` (e.g. `BrowserWindow`).
   * @param channel - One of the declared event names.
   * @param args    - Payload arguments matching the schema descriptor's parameters.
   */
  emit<K extends keyof T & string>(
    target: WindowTarget,
    channel: K,
    ...args: Parameters<T[K]>
  ): void;
}

// ─── Menu Action Descriptors ──────────────────────────────────────────────────

/**
 * Calls a local function when the menu item is activated.
 *
 * Use for direct, synchronous logic or fire-and-forget async operations that
 * live entirely in the main process and do not need IPC.
 *
 * @example
 * ```ts
 * { kind: 'command', run: () => openFileDialog() }
 * ```
 */
export interface CommandActionDescriptor {
  readonly kind: 'command';
  /** The function to invoke. May be async; errors are caught and logged. */
  run: () => void | Promise<void>;
}

/**
 * Calls a shared service function when the menu item is activated.
 *
 * Semantically distinct from `'command'` to signal that `call` is a **shared
 * service function** — i.e., the same function that an IPC handler may also
 * delegate to. This enforces the architectural rule that menu clicks and IPC
 * calls share business logic rather than duplicating it.
 *
 * Never invoke an `ipcMain.handle` channel directly from a menu descriptor.
 * Register the business logic as a plain function and call it from both the
 * IPC handler and the service descriptor.
 *
 * @example
 * ```ts
 * // services/fileService.ts
 * export async function openFolder() { ... }
 *
 * // main.ts
 * const api = defineIpcApi({ openFolder });               // IPC entry point
 * const actions: ActionRegistry = {
 *   'file.open': serviceAction(openFolder),               // menu entry point
 * };
 * ```
 */
export interface ServiceActionDescriptor {
  readonly kind: 'service';
  /** The shared service function to invoke. May be async; errors are caught and logged. */
  call: () => void | Promise<void>;
}

/**
 * Pushes a typed IPC event to a renderer window when the menu item is activated.
 *
 * The `emit` function must be **pre-bound** — provide a zero-arg closure that
 * captures the window reference and calls `events.emit(window, channel, ...args)`.
 * This avoids threading the window reference through the registry at type-definition
 * time while still keeping the call fully type-checked.
 *
 * @example
 * ```ts
 * // events.ts
 * export const events = defineIpcEvents({ folderOpened: (_path: string) => {} });
 *
 * // main.ts
 * const actions: ActionRegistry = {
 *   'file.open': emitAction(() => events.emit(mainWindow!, 'folderOpened', '/home/user')),
 * };
 * ```
 */
export interface EmitActionDescriptor {
  readonly kind: 'emit';
  /** Zero-arg closure that calls `events.emit(target, channel, ...args)`. */
  emit: () => void;
}

/**
 * A discriminated union of all supported menu action descriptor kinds.
 *
 * Use the `kind` field to switch exhaustively:
 * ```ts
 * switch (descriptor.kind) {
 *   case 'command': descriptor.run(); break;
 *   case 'service': descriptor.call(); break;
 *   case 'emit':    descriptor.emit(); break;
 * }
 * ```
 */
export type ActionDescriptor =
  | CommandActionDescriptor
  | ServiceActionDescriptor
  | EmitActionDescriptor;

/**
 * Maps `actionId` strings (from the declarative menu spec) to typed descriptors.
 *
 * All registered actions are resolved at click-time via `buildMenuTemplate`.
 * Unknown `actionId` values produce a console warning and are no-ops.
 */
export type ActionRegistry = Record<string, ActionDescriptor>;

// ─── Utility Types ────────────────────────────────────────────────────────────

/**
 * Extracts the fully-typed renderer API from an `IpcApi` handle.
 *
 * Use this in your renderer type declarations to augment `Window`
 * and get full type safety when calling `window.api.*`.
 *
 * @example
 * ```ts
 * // renderer.d.ts
 * import type { api } from '../src-electron/api';
 * import type { ExtractRendererApi } from 'electron-message-bridge';
 *
 * declare global {
 *   interface Window {
 *     api: ExtractRendererApi<typeof api>;
 *   }
 * }
 * ```
 */
export type ExtractRendererApi<T> = T extends IpcApi<infer H>
  ? RendererApi<H>
  : never;

/**
 * Extracts the fully-typed renderer event subscriptions from an `IpcEvents` handle.
 *
 * Use this alongside `ExtractRendererApi` to augment `Window` with push-event types.
 *
 * @example
 * ```ts
 * // renderer.d.ts
 * import type { events } from '../src-electron/events';
 * import type { ExtractRendererEvents } from 'electron-message-bridge';
 *
 * declare global {
 *   interface Window {
 *     events: ExtractRendererEvents<typeof events>;
 *   }
 * }
 * ```
 */
export type ExtractRendererEvents<T> = T extends IpcEvents<infer H>
  ? RendererEvents<H>
  : never;
