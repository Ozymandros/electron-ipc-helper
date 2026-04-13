/**
 * Lazy-loader shim for `@electron-message-bridge/adapter-stdio`.
 *
 * Importing this file does **not** load the adapter package eagerly.
 * Call `loadStdioAdapter()` at runtime to import it.
 * If the package is not installed, an `AdapterMissingError` is thrown.
 *
 * @example
 * ```ts
 * import { loadStdioAdapter } from 'electron-message-bridge/adapters/stdio';
 *
 * const adapter = await loadStdioAdapter();
 * const transport = adapter.createStdioServerTransport({
 *   readable: child.stdout,
 *   writable: child.stdin,
 * });
 * ```
 */

import { requireAdapter } from './loader.js';
import type * as StdioAdapterModule from '@electron-message-bridge/adapter-stdio';

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
} from '@electron-message-bridge/adapter-stdio';

// ─── Lazy loader ──────────────────────────────────────────────────────────────

/**
 * Dynamically import the stdio adapter package.
 *
 * Throws `AdapterMissingError` if `@electron-message-bridge/adapter-stdio`
 * is not installed in the consuming project.
 *
 * @returns All named exports of the adapter package.
 */
export function loadStdioAdapter(): Promise<typeof StdioAdapterModule> {
  return requireAdapter(
    '@electron-message-bridge/adapter-stdio',
    () => import('@electron-message-bridge/adapter-stdio'),
  );
}
