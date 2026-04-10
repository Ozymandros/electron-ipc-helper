/**
 * Lazy-loader shim for `@electron-ipc-helper/adapter-grpc`.
 *
 * Importing this file from the main package does **not** load the adapter
 * package eagerly. Call `loadGrpcAdapter()` at runtime to import it.
 * If the package is not installed, an `AdapterMissingError` is thrown.
 *
 * @example
 * ```ts
 * import { loadGrpcAdapter } from 'electron-ipc-helper/adapters/grpc';
 *
 * const adapter = await loadGrpcAdapter();
 * const transport = adapter.createGrpcServerTransport({ address: '127.0.0.1:50051' });
 * ```
 */

import { requireAdapter } from './loader.js';
import type * as GrpcAdapterModule from '@electron-ipc-helper/adapter-grpc';

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
} from '@electron-ipc-helper/adapter-grpc';

// ─── Lazy loader ──────────────────────────────────────────────────────────────

/**
 * Dynamically import the gRPC adapter package.
 *
 * Throws `AdapterMissingError` if `@electron-ipc-helper/adapter-grpc` is not
 * installed in the consuming project. This adapter also requires `@grpc/grpc-js`
 * as a peer dependency.
 *
 * @returns All named exports of the adapter package.
 */
export function loadGrpcAdapter(): Promise<typeof GrpcAdapterModule> {
  return requireAdapter(
    '@electron-ipc-helper/adapter-grpc',
    () => import('@electron-ipc-helper/adapter-grpc'),
  );
}
