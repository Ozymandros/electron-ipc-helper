/**
 * Unit tests for defineIpcEvents (main process) and
 * exposeEventsToRenderer / exposeValues (preload).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { contextBridge, ipcRenderer, resetMocks } from './__mocks__/electron.js';
import { defineIpcEvents } from '../src/main.js';
import { exposeEventsToRenderer, exposeValues } from '../src/preload.js';

beforeEach(() => {
  resetMocks();
});

// ─── defineIpcEvents — handle ─────────────────────────────────────────────────

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

// ─── exposeEventsToRenderer ───────────────────────────────────────────────────

describe('exposeEventsToRenderer', () => {
  it('exposes a listener function for each declared channel', () => {
    const events = defineIpcEvents({
      backendReady:   (_code: number) => {},
      folderSelected: (_path: string) => {},
    });
    exposeEventsToRenderer(events);

    const exposed = contextBridge._exposed.get('events');
    expect(exposed).toHaveProperty('backendReady');
    expect(exposed).toHaveProperty('folderSelected');
    expect(typeof (exposed as any).backendReady).toBe('function');
  });

  it('registers an ipcRenderer.on listener when the exposed function is called', () => {
    const events = defineIpcEvents({ test: (_x: string) => {} });
    exposeEventsToRenderer(events);

    const exposed = contextBridge._exposed.get('events') as any;
    exposed.test(vi.fn());

    expect(ipcRenderer.on).toHaveBeenCalledWith('test', expect.any(Function));
  });

  it('strips the IpcRendererEvent and forwards only user args to the callback', () => {
    const events = defineIpcEvents({ test: (_x: string) => {} });
    exposeEventsToRenderer(events);

    const exposed = contextBridge._exposed.get('events') as any;
    const cb = vi.fn();
    exposed.test(cb);

    // Simulate main process emitting: Electron wraps args as (event, ...userArgs)
    ipcRenderer._emit('test', { sender: null }, 'hello');

    expect(cb).toHaveBeenCalledWith('hello');
    expect(cb).not.toHaveBeenCalledWith(
      expect.objectContaining({ sender: expect.anything() }),
      expect.anything(),
    );
  });

  it('returns an unsubscribe function that removes the listener', () => {
    const events = defineIpcEvents({ test: (_x: string) => {} });
    exposeEventsToRenderer(events);

    const exposed = contextBridge._exposed.get('events') as any;
    const cb = vi.fn();
    const unsubscribe = exposed.test(cb);

    unsubscribe();

    expect(ipcRenderer.removeListener).toHaveBeenCalledWith('test', expect.any(Function));
  });

  it('unsubscribed listener is not invoked after unsubscribe', () => {
    const events = defineIpcEvents({ test: () => {} });
    exposeEventsToRenderer(events);

    const exposed = contextBridge._exposed.get('events') as any;
    const cb = vi.fn();
    const unsubscribe = exposed.test(cb);

    unsubscribe();
    ipcRenderer._emit('test', { sender: null });

    expect(cb).not.toHaveBeenCalled();
  });

  it('multiple subscriptions to the same channel are independent', () => {
    const events = defineIpcEvents({ test: () => {} });
    exposeEventsToRenderer(events);

    const exposed = contextBridge._exposed.get('events') as any;
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const unsub1 = exposed.test(cb1);
    exposed.test(cb2);

    unsub1();
    ipcRenderer._emit('test', { sender: null });

    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  it('mounts under a custom key when provided', () => {
    const events = defineIpcEvents({ ready: () => {} });
    exposeEventsToRenderer(events, 'myEvents');

    expect(contextBridge._exposed.has('myEvents')).toBe(true);
    expect(contextBridge._exposed.has('events')).toBe(false);
  });
});

// ─── exposeValues ─────────────────────────────────────────────────────────────

describe('exposeValues', () => {
  it('exposes a values object under the given key', () => {
    exposeValues({ platform: 'linux', version: '1.0.0' }, 'meta');

    expect(contextBridge._exposed.get('meta')).toEqual({
      platform: 'linux',
      version: '1.0.0',
    });
  });

  it('calls contextBridge.exposeInMainWorld exactly once', () => {
    exposeValues({ x: 1 }, 'meta');

    expect(contextBridge.exposeInMainWorld).toHaveBeenCalledTimes(1);
    expect(contextBridge.exposeInMainWorld).toHaveBeenCalledWith('meta', { x: 1 });
  });
});
