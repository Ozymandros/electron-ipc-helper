/**
 * Lazy-loader shim for `@electron-ipc-helper/adapter-named-pipe`.
 *
 * Importing this file from the main package does **not** load the adapter
 * package eagerly. Call `loadNamedPipeAdapter()` at runtime to import it.
 * If the package is not installed, an `AdapterMissingError` is thrown.
 *
 * @example
 * ```ts
 * import { loadNamedPipeAdapter } from 'electron-ipc-helper/adapters/named-pipe';
 *
 * const adapter = await loadNamedPipeAdapter();
 * const transport = adapter.createNamedPipeServerTransport('/tmp/my-app.sock');
 * ```
 */

import { requireAdapter } from './loader.js';
import type * as NamedPipeAdapterModule from '@electron-ipc-helper/adapter-named-pipe';

// Static type-only re-exports (erased at runtime — no side effects).
export type {
  NamedPipeServerTransport,
  NamedPipeClientTransport,
  NamedPipePlugin,
  NamedPipeServerTransportOptions,
  NamedPipeClientTransportOptions,
  NamedPipeCapabilities,
} from '@electron-ipc-helper/adapter-named-pipe';

// ─── Lazy loader ──────────────────────────────────────────────────────────────

/**
 * Dynamically import the Named Pipe adapter package.
 *
 * Throws `AdapterMissingError` if `@electron-ipc-helper/adapter-named-pipe`
 * is not installed in the consuming project.
 *
 * @returns All named exports of the adapter package.
 */
export function loadNamedPipeAdapter(): Promise<typeof NamedPipeAdapterModule> {
  return requireAdapter(
    '@electron-ipc-helper/adapter-named-pipe',
    () => import('@electron-ipc-helper/adapter-named-pipe'),
  );
}
