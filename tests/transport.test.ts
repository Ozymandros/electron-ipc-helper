/**
 * Tests for src/transport.ts
 *
 * Covers:
 *  - TransportAdapter interface structural contract
 *  - IpcTransport (default Electron IPC transport)
 *  - defineIpcApi integration with custom transport
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// vi.hoisted ensures these refs are initialised before the vi.mock factory runs.
const { ipcMainHandleMock, ipcMainRemoveHandlerMock } = vi.hoisted(() => ({
  ipcMainHandleMock: vi.fn(),
  ipcMainRemoveHandlerMock: vi.fn(),
}));

vi.mock('electron', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as Record<string, unknown>),
    ipcMain: {
      handle: ipcMainHandleMock,
      removeHandler: ipcMainRemoveHandlerMock,
    },
    ipcRenderer: {
      invoke: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn(),
    },
  };
});

// ─── Imports ──────────────────────────────────────────────────────────────────

import { IpcTransport } from '../src/transport.js';
import type { TransportAdapter, TransportHandler } from '../src/transport.js';
import { defineIpcApi } from '../src/main.js';

// ─── IpcTransport ─────────────────────────────────────────────────────────────

describe('IpcTransport', () => {
  beforeEach(() => {
    ipcMainHandleMock.mockReset();
    ipcMainRemoveHandlerMock.mockReset();
  });

  it('has name "ipc"', () => {
    const t = new IpcTransport();
    expect(t.name).toBe('ipc');
  });

  it('handle() calls ipcMain.handle with the channel', () => {
    const t = new IpcTransport();
    const handler: TransportHandler = vi.fn(async () => null);
    t.handle('myChannel', handler);
    expect(ipcMainHandleMock).toHaveBeenCalledWith('myChannel', expect.any(Function));
  });

  it('invoke() throws — use ipcRenderer in preload instead', () => {
    const t = new IpcTransport();
    expect(() => t.invoke('ch', null)).toThrow('IpcTransport.invoke()');
  });

  it('dispose() calls ipcMain.removeHandler for all registered channels', async () => {
    const t = new IpcTransport();
    const h: TransportHandler = vi.fn(async () => null);
    t.handle('alpha', h);
    t.handle('beta', h);
    await t.dispose();
    expect(ipcMainRemoveHandlerMock).toHaveBeenCalledWith('alpha');
    expect(ipcMainRemoveHandlerMock).toHaveBeenCalledWith('beta');
  });

  it('dispose() is idempotent — second call removes nothing extra', async () => {
    const t = new IpcTransport();
    t.handle('ch', vi.fn(async () => null));
    await t.dispose();
    await t.dispose(); // second call — nothing to remove
    expect(ipcMainRemoveHandlerMock).toHaveBeenCalledTimes(1);
  });
});

// ─── TransportAdapter interface conformance ───────────────────────────────────

describe('TransportAdapter — interface contract', () => {
  it('satisfies interface: in-memory stub transport', async () => {
    const handlers = new Map<string, TransportHandler>();

    const stub: TransportAdapter = {
      name: 'stub',
      handle: (ch, fn) => { handlers.set(ch, fn); },
      invoke: async (ch, payload) => {
        const fn = handlers.get(ch);
        if (!fn) throw new Error(`No handler for ${ch}`);
        return fn(payload);
      },
    };

    stub.handle('echo', async (p) => p);
    const result = await stub.invoke('echo', { hello: 'world' });
    expect(result).toEqual({ hello: 'world' });
  });

  it('optional start/dispose are not required by the interface', () => {
    const minimal: TransportAdapter = {
      name: 'minimal',
      handle: () => {},
      invoke: async () => null,
      // start and dispose are intentionally absent
    };

    expect(minimal.start).toBeUndefined();
    expect(minimal.dispose).toBeUndefined();
  });
});

// ─── defineIpcApi with custom transport ───────────────────────────────────────

describe('defineIpcApi — custom transport integration', () => {
  beforeEach(() => {
    ipcMainHandleMock.mockReset();
    ipcMainRemoveHandlerMock.mockReset();
  });

  it('registers handlers via the transport when transport option is provided', () => {
    const registrations: string[] = [];
    const transport: TransportAdapter = {
      name: 'test',
      handle: (ch) => { registrations.push(ch); },
      invoke: async () => null,
    };

    defineIpcApi(
      { getUser: async (id: string) => ({ id }), ping: async () => 'pong' },
      { transport },
    );

    expect(registrations).toContain('getUser');
    expect(registrations).toContain('ping');
    // ipcMain.handle must NOT be called when a transport is provided
    expect(ipcMainHandleMock).not.toHaveBeenCalled();
  });

  it('falls back to ipcMain when no transport is given', () => {
    defineIpcApi({ echo: async (x: unknown) => x });
    expect(ipcMainHandleMock).toHaveBeenCalledWith('echo', expect.any(Function));
  });

  it('transport handler receives the correct payload and returns the result', async () => {
    let capturedHandler: TransportHandler | null = null;
    const transport: TransportAdapter = {
      name: 'test',
      handle: (_, fn) => { capturedHandler = fn; },
      invoke: async () => null,
    };

    defineIpcApi(
      { double: async (n: number) => n * 2 },
      { transport },
    );

    expect(capturedHandler).not.toBeNull();
    const result = await capturedHandler!(42);
    expect(result).toBe(84);
  });

  it('calls transport.start() after registering all handlers', async () => {
    const startOrder: string[] = [];
    const transport: TransportAdapter = {
      name: 'test',
      handle: (ch) => { startOrder.push(`handle:${ch}`); },
      invoke: async () => null,
      start: async () => { startOrder.push('start'); },
    };

    defineIpcApi(
      { a: async () => 1, b: async () => 2 },
      { transport },
    );

    // start() is called asynchronously after handle() — wait a tick
    await Promise.resolve();

    expect(startOrder).toContain('handle:a');
    expect(startOrder).toContain('handle:b');
    expect(startOrder[startOrder.length - 1]).toBe('start');
  });

  it('dispose() triggers transport.dispose() when transport was used', async () => {
    const disposed = vi.fn(async () => {});
    const transport: TransportAdapter = {
      name: 'test',
      handle: () => {},
      invoke: async () => null,
      dispose: disposed,
    };

    const api = defineIpcApi({ noop: async () => null }, { transport });
    api.dispose();

    await new Promise((r) => setTimeout(r, 10)); // let the async chain settle
    expect(disposed).toHaveBeenCalledOnce();
  });

  it('dispose() calls ipcMain.removeHandler when no transport was used', () => {
    const api = defineIpcApi({ ch: async () => null });
    api.dispose();
    expect(ipcMainRemoveHandlerMock).toHaveBeenCalledWith('ch');
  });
});
