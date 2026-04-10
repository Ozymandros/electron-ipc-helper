/**
 * Lazy-loader shim for `@electron-ipc-helper/adapter-stdio`.
 *
 * Importing this file does **not** load the adapter package eagerly.
 * Call `loadStdioAdapter()` at runtime to import it.
 * If the package is not installed, an `AdapterMissingError` is thrown.
 *
 * @example
 * ```ts
 * import { loadStdioAdapter } from 'electron-ipc-helper/adapters/stdio';
 *
 * const adapter = await loadStdioAdapter();
 * const transport = adapter.createStdioServerTransport({
 *   readable: child.stdout,
 *   writable: child.stdin,
 * });
 * ```
 */

import { requireAdapter } from './loader.js';
import type * as StdioAdapterModule from '@electron-ipc-helper/adapter-stdio';

// Static type-only re-exports (erased at runtime — no side effects).
export type {
  StdioServerTransport,
  StdioClientTransport,
  StdioPlugin,
  StdioServerTransportOptions,
  StdioClientTransportOptions,
  StdioCapabilities,
  StdioRequest,
  StdioResponse,
  StdioFrame,
} from '@electron-ipc-helper/adapter-stdio';

// ─── Lazy loader ──────────────────────────────────────────────────────────────

/**
 * Dynamically import the stdio adapter package.
 *
 * Throws `AdapterMissingError` if `@electron-ipc-helper/adapter-stdio`
 * is not installed in the consuming project.
 *
 * @returns All named exports of the adapter package.
 */
export function loadStdioAdapter(): Promise<typeof StdioAdapterModule> {
  return requireAdapter(
    '@electron-ipc-helper/adapter-stdio',
    () => import('@electron-ipc-helper/adapter-stdio'),
  );
}
