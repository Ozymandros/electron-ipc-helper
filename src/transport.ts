/**
 * @module transport
 *
 * Transport abstraction for @ozymandros/electron-message-bridge.
 *
 * The `TransportAdapter` interface decouples the request/response handler
 * mechanism from Electron's built-in IPC channel. Alternative implementations
 * (Named Pipes, gRPC, …) register with `defineIpcApi` via the `transport`
 * option and expose the same typed API surface over a different wire protocol.
 *
 * ## Architecture
 *
 * ```
 *  Main process                    Remote client
 * ┌─────────────────┐             ┌─────────────────┐
 * │  defineIpcApi   │             │  ClientTransport │
 * │  ┌───────────┐  │  wire proto │  ┌───────────┐  │
 * │  │ Transport │◄─┼─────────────┼─►│  invoke() │  │
 * │  │ (server)  │  │             │  └───────────┘  │
 * │  └───────────┘  │             └─────────────────┘
 * └─────────────────┘
 * ```
 *
 * The default behaviour (no `transport` option) uses Electron's built-in IPC
 * (`ipcMain.handle` / `ipcRenderer.invoke`) and works transparently with
 * `exposeApiToRenderer` in the preload script.
 */

import * as electron from 'electron';
import type { BridgePayload } from './boundary.js';

const ipcMain = (electron as { ipcMain?: typeof electron.ipcMain; default?: { ipcMain?: typeof electron.ipcMain } }).ipcMain
  ?? (electron as { default?: { ipcMain?: typeof electron.ipcMain } }).default?.ipcMain;

// ─── Handler type ─────────────────────────────────────────────────────────────

/**
 * A handler function registered on the server side of a transport.
 *
 * Receives a `BridgePayload` (JSON-serialisable) and returns a
 * `BridgePayload` wrapped in a Promise.
 */
export type TransportHandler = (payload: BridgePayload) => Promise<BridgePayload>;

// ─── TransportAdapter ─────────────────────────────────────────────────────────

/**
 * Pluggable transport for @ozymandros/electron-message-bridge.
 *
 * Implement this interface to expose your `defineIpcApi` handlers over any
 * protocol — Named Pipes, gRPC, WebSockets, stdio, etc. — without changing
 * the handler definitions or call sites.
 *
 * @example
 * ```ts
 * // main.ts
 * import { defineIpcApi } from '@ozymandros/electron-message-bridge';
 * import { createNamedPipeServerTransport } from '@ozymandros/electron-message-bridge-adapter-named-pipe';
 *
 * const transport = createNamedPipeServerTransport('/tmp/my-app.sock');
 *
 * export const api = defineIpcApi(
 *   { getUser: async (id: string) => db.users.findById(id) },
 *   { transport },
 * );
 * ```
 */
export interface TransportAdapter {
  /**
   * Human-readable transport name used in logs and diagnostics.
   * @example 'ipc', 'named-pipe', 'grpc'
   */
  readonly name: string;

  /**
   * Register a server-side handler for `channel`.
   *
   * Called once per channel during `defineIpcApi` setup. The transport
   * dispatches incoming requests to the registered handler and sends the
   * resolved value back to the caller.
   *
   * Implementations MUST NOT invoke the handler synchronously inside
   * `handle()` — the call happens only when a remote request arrives.
   */
  handle(channel: string, handler: TransportHandler): void;

  /**
   * Send a request to the server side and await the response.
   *
   * Used by **client** transports. Server-only transports may throw
   * `new Error('invoke not supported on server transport')` here.
   *
   * @param channel - The registered channel name to call.
   * @param payload - JSON-serialisable request payload.
   * @returns JSON-serialisable response payload.
   */
  invoke(channel: string, payload: BridgePayload): Promise<BridgePayload>;

  /**
   * Start listening for incoming connections / requests.
   *
   * Called automatically by `defineIpcApi` after all handlers have been
   * registered. Implement when your transport needs an explicit "bind" step
   * (e.g., binding a TCP port, opening a pipe file).
   */
  start?(): Promise<void>;

  /**
   * Tear down all open connections and release resources.
   *
   * Called automatically by the `IpcApi.dispose()` handle returned from
   * `defineIpcApi`. Implement for clean shutdown (close server socket,
   * terminate gRPC channel, etc.).
   */
  dispose?(): Promise<void>;
}

// ─── IpcTransport (default) ───────────────────────────────────────────────────

/**
 * Default Electron IPC transport — wraps `ipcMain.handle` / `ipcRenderer.invoke`.
 *
 * This is the transport used internally when no `transport` option is passed to
 * `defineIpcApi`. You do **not** need to instantiate it directly.
 *
 * Only the `handle` and `dispose` roles are relevant here; `invoke` is handled
 * by `ipcRenderer.invoke` in the preload script via `exposeApiToRenderer`.
 */
export class IpcTransport implements TransportAdapter {
  readonly name = 'ipc' as const;

  /** Map of channel → registered handler (for disposal). */
  private readonly registeredChannels: string[] = [];

  handle(channel: string, handler: TransportHandler): void {
    if (!ipcMain) {
      throw new Error('[@ozymandros/electron-message-bridge] ipcMain is not available in this runtime');
    }

    ipcMain.handle(channel, (_event: unknown, ...args: unknown[]) =>
      handler(args[0] as BridgePayload),
    );

    this.registeredChannels.push(channel);
  }

  invoke(_channel: string, _payload: BridgePayload): Promise<BridgePayload> {
    throw new Error(
      '[@ozymandros/electron-message-bridge] IpcTransport.invoke() is not supported — ' +
        'use ipcRenderer.invoke() in your preload script instead.',
    );
  }

  async dispose(): Promise<void> {
    if (!ipcMain) return;

    for (const channel of this.registeredChannels) {
      ipcMain.removeHandler(channel);
    }
    this.registeredChannels.length = 0;
  }
}