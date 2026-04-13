/**
 * Lazy-loader shim for `@electron-message-bridge/adapter-grpc`.
 *
 * Importing this file from the main package does **not** load the adapter
 * package eagerly. Call `loadGrpcAdapter()` at runtime to import it.
 * If the package is not installed, an `AdapterMissingError` is thrown.
 *
 * @example
 * ```ts
 * import { loadGrpcAdapter } from 'electron-message-bridge/adapters/grpc';
 *
 * const adapter = await loadGrpcAdapter();
 * const transport = adapter.createGrpcServerTransport({ address: '127.0.0.1:50051' });
 * ```
 */

import { requireAdapter } from './loader.js';
import type * as GrpcAdapterModule from '@electron-message-bridge/adapter-grpc';

// Static type-only re-exports (erased at runtime — no side effects).
export type {
  GrpcServerTransport,
  GrpcClientTransport,
  GrpcPlugin,
  GrpcServerTransportOptions,
  GrpcClientTransportOptions,
  GrpcCapabilities,
  InvokeRequest,
  InvokeResponse,
} from '@electron-message-bridge/adapter-grpc';

// ─── Lazy loader ──────────────────────────────────────────────────────────────

/**
 * Dynamically import the gRPC adapter package.
 *
 * Throws `AdapterMissingError` if `@electron-message-bridge/adapter-grpc` is not
 * installed in the consuming project. This adapter also requires `@grpc/grpc-js`
 * as a peer dependency.
 *
 * @returns All named exports of the adapter package.
 */
export function loadGrpcAdapter(): Promise<typeof GrpcAdapterModule> {
  return requireAdapter(
    '@electron-message-bridge/adapter-grpc',
    () => import('@electron-message-bridge/adapter-grpc'),
  );
}
