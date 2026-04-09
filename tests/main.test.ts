/**
 * Unit tests for defineIpcApi and defineIpcEvents (main process).
 *
 * The 'electron' module is replaced by our Vitest alias so no real Electron
 * runtime is required.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ipcMain, resetMocks } from './__mocks__/electron.js';
import { defineIpcApi, defineIpcEvents } from '../src/main.js';

beforeEach(() => {
  resetMocks();
});

// ─── defineIpcApi — handler registration ─────────────────────────────────────

describe('defineIpcApi — handler registration', () => {
  it('registers one handler per key with ipcMain.handle', () => {
    defineIpcApi({
      getUser:      async (_id: string) => ({ id: _id, name: 'Alice' }),
      saveSettings: async (_s: object)  => true,
    });

    expect(ipcMain.handle).toHaveBeenCalledTimes(2);
    expect(ipcMain.handle).toHaveBeenCalledWith('getUser',      expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith('saveSettings', expect.any(Function));
  });

  it('uses handler object keys as channel names', () => {
    defineIpcApi({ ping: async () => 'pong', version: async () => '1.0.0' });

    const channels = ipcMain.handle.mock.calls.map(([ch]) => ch);
    expect(channels).toContain('ping');
    expect(channels).toContain('version');
  });

  it('registers handlers for only own enumerable keys', () => {
    defineIpcApi({ alpha: async () => 1, beta: async () => 2 });
    expect(ipcMain.handle).toHaveBeenCalledTimes(2);
  });
});

// ─── defineIpcApi — return value ─────────────────────────────────────────────

describe('defineIpcApi — return value', () => {
  it('returns an IpcApi handle with all channel names', () => {
    const api = defineIpcApi({
      getUser:    async (_id: string) => ({ id: _id }),
      deleteUser: async (_id: string) => void 0,
    });

    expect(api._channels).toContain('getUser');
    expect(api._channels).toContain('deleteUser');
    expect(api._channels).toHaveLength(2);
  });

  it('returns a frozen _channels array (read-only contract)', () => {
    const api = defineIpcApi({ ping: async () => 'pong' });
    expect(() => {
      (api._channels as string[]).push('injected');
    }).toThrow();
  });
});

// ─── defineIpcApi — handler execution ────────────────────────────────────────

describe('defineIpcApi — handler execution', () => {
  it('forwards arguments from the registered Electron handler', async () => {
    const getUser = vi.fn(async (id: string) => ({ id, name: 'Bob' }));
    defineIpcApi({ getUser });

    const wrapper = ipcMain.handle.mock.calls[0]![1];
    const result = await wrapper({ sender: null }, '42');

    expect(getUser).toHaveBeenCalledWith('42');
    expect(result).toEqual({ id: '42', name: 'Bob' });
  });

  it('does NOT forward the IpcMainInvokeEvent to the handler', async () => {
    const handler = vi.fn(async () => 'ok');
    defineIpcApi({ handler });

    const wrapper = ipcMain.handle.mock.calls[0]![1];
    await wrapper({ sender: { id: 1 } }, 'arg1', 'arg2');

    expect(handler).toHaveBeenCalledWith('arg1', 'arg2');
    expect(handler).not.toHaveBeenCalledWith(
      expect.objectContaining({ sender: expect.anything() }),
    );
  });

  it('supports multiple arguments', async () => {
    const handler = vi.fn(async (a: string, b: number) => `${a}-${b}`);
    defineIpcApi({ handler });

    const wrapper = ipcMain.handle.mock.calls[0]![1];
    const result = await wrapper({}, 'hello', 99);

    expect(handler).toHaveBeenCalledWith('hello', 99);
    expect(result).toBe('hello-99');
  });
});

// ─── defineIpcApi — error propagation ────────────────────────────────────────

describe('defineIpcApi — error propagation', () => {
  it('propagates synchronous throws from handlers', async () => {
    defineIpcApi({
      boom: async () => { throw new Error('exploded'); },
    });

    const wrapper = ipcMain.handle.mock.calls[0]![1];
    await expect(wrapper({})).rejects.toThrow('exploded');
  });

  it('propagates rejected promises from handlers', async () => {
    defineIpcApi({
      asyncBoom: async () => Promise.reject(new Error('async exploded')),
    });

    const wrapper = ipcMain.handle.mock.calls[0]![1];
    await expect(wrapper({})).rejects.toThrow('async exploded');
  });
});

// ─── defineIpcApi — guard rails ──────────────────────────────────────────────

describe('defineIpcApi — guard rails', () => {
  it('throws an InvalidPayloadError if a handler value is not a function', async () => {
    const { InvalidPayloadError } = await import('../src/errors.js');
    expect(() => {
      defineIpcApi({
        // @ts-expect-error intentional bad input
        badHandler: 'not-a-function',
      });
    }).toThrow(InvalidPayloadError);
  });
});

// ─── defineIpcApi — dispose ───────────────────────────────────────────────────

describe('defineIpcApi — dispose', () => {
  it('calls ipcMain.removeHandler for every registered channel', () => {
    const api = defineIpcApi({
      getUser:      async (_id: string) => ({ id: _id }),
      saveSettings: async ()            => true,
    });

    api.dispose();

    expect(ipcMain.removeHandler).toHaveBeenCalledTimes(2);
    expect(ipcMain.removeHandler).toHaveBeenCalledWith('getUser');
    expect(ipcMain.removeHandler).toHaveBeenCalledWith('saveSettings');
  });

  it('removes only the channels belonging to this handle', () => {
    const api = defineIpcApi({ ping: async () => 'pong' });
    api.dispose();

    expect(ipcMain.removeHandler).toHaveBeenCalledWith('ping');
    expect(ipcMain.removeHandler).toHaveBeenCalledTimes(1);
  });

  it('is idempotent — calling dispose twice does not throw', () => {
    const api = defineIpcApi({ ping: async () => 'pong' });
    expect(() => {
      api.dispose();
      api.dispose();
    }).not.toThrow();
  });
});

// ─── defineIpcEvents — handle ────────────────────────────────────────────────

describe('defineIpcEvents — handle', () => {
  it('returns an IpcEvents handle with all channel names', () => {
    const events = defineIpcEvents({
      backendReady:   (_code: number) => {},
      folderSelected: (_path: string) => {},
    });

    expect(events._channels).toContain('backendReady');
    expect(events._channels).toContain('folderSelected');
    expect(events._channels).toHaveLength(2);
  });

  it('returns a frozen _channels array (read-only contract)', () => {
    const events = defineIpcEvents({ test: () => {} });
    expect(() => {
      (events._channels as string[]).push('injected');
    }).toThrow();
  });
});

// ─── defineIpcEvents — emit ───────────────────────────────────────────────────

describe('defineIpcEvents — emit', () => {
  it('calls webContents.send with the channel name and args', () => {
    const events = defineIpcEvents({ backendReady: (_code: number) => {} });
    const mockWin = { webContents: { send: vi.fn() } };

    events.emit(mockWin, 'backendReady', 42);

    expect(mockWin.webContents.send).toHaveBeenCalledWith('backendReady', 42);
  });

  it('forwards multiple arguments', () => {
    const events = defineIpcEvents({
      backendCrashed: (_code: number | null, _signal: string | null) => {},
    });
    const mockWin = { webContents: { send: vi.fn() } };

    events.emit(mockWin, 'backendCrashed', 1, 'SIGTERM');

    expect(mockWin.webContents.send).toHaveBeenCalledWith('backendCrashed', 1, 'SIGTERM');
  });

  it('forwards zero-argument events', () => {
    const events = defineIpcEvents({ ping: () => {} });
    const mockWin = { webContents: { send: vi.fn() } };

    events.emit(mockWin, 'ping');

    expect(mockWin.webContents.send).toHaveBeenCalledWith('ping');
  });
});
