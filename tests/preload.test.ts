/**
 * Unit tests for exposeApiToRenderer, exposeEventsToRenderer, and exposeValues
 * (preload script).
 *
 * The 'electron' module is replaced by our Vitest alias so no real Electron
 * runtime is required.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { contextBridge, ipcRenderer, resetMocks } from './__mocks__/electron.js';
import {
  defineIpcApi,
  defineIpcEvents,
} from '../src/main.js';
import {
  exposeApiToRenderer,
  exposeEventsToRenderer,
  exposeValues,
} from '../src/preload.js';
import {
  exposeDialogsToRenderer,
  exposeShellToRenderer,
  registerDialogHandlers,
  registerShellHandlers,
} from '../src/integrations.js';

beforeEach(() => {
  resetMocks();
});

// ─── exposeApiToRenderer ──────────────────────────────────────────────────────

describe('exposeApiToRenderer', () => {
  it('calls contextBridge.exposeInMainWorld with "api" key by default', () => {
    const api = defineIpcApi({ getUser: async (_id: string) => ({ id: _id }) });
    exposeApiToRenderer(api);

    expect(contextBridge.exposeInMainWorld).toHaveBeenCalledWith('api', expect.any(Object));
  });

  it('accepts a custom window key', () => {
    const api = defineIpcApi({ ping: async () => 'pong' });
    exposeApiToRenderer(api, 'myApp');

    expect(contextBridge.exposeInMainWorld).toHaveBeenCalledWith('myApp', expect.any(Object));
  });

  it('exposes a function for each registered channel', () => {
    const api = defineIpcApi({
      getUser:      async (_id: string) => ({ id: _id }),
      saveSettings: async ()            => true,
    });
    exposeApiToRenderer(api);

    const exposed = contextBridge._exposed.get('api')!;
    expect(typeof exposed['getUser']).toBe('function');
    expect(typeof exposed['saveSettings']).toBe('function');
  });

  it('exposes exactly the declared channels — no extras', () => {
    const api = defineIpcApi({ ping: async () => 'pong' });
    exposeApiToRenderer(api);

    const exposed = contextBridge._exposed.get('api')!;
    expect(Object.keys(exposed)).toEqual(['ping']);
  });

  it('proxies calls through ipcRenderer.invoke', async () => {
    const api = defineIpcApi({ ping: async () => 'pong' });
    exposeApiToRenderer(api);

    const exposed = contextBridge._exposed.get('api') as Record<string, (...a: unknown[]) => unknown>;
    await (exposed['ping'] as () => Promise<unknown>)();

    expect(ipcRenderer.invoke).toHaveBeenCalledWith('ping');
  });

  it('forwards arguments to ipcRenderer.invoke', async () => {
    const api = defineIpcApi({ getUser: async (_id: string) => ({ id: _id }) });
    exposeApiToRenderer(api);

    const exposed = contextBridge._exposed.get('api') as Record<string, (...a: unknown[]) => unknown>;
    await (exposed['getUser'] as (id: string) => Promise<unknown>)('123');

    expect(ipcRenderer.invoke).toHaveBeenCalledWith('getUser', '123');
  });

  it('returns the resolved value from the main process handler', async () => {
    const api = defineIpcApi({ ping: async () => 'pong' });
    exposeApiToRenderer(api);

    const exposed = contextBridge._exposed.get('api') as Record<string, () => Promise<unknown>>;
    const result = await exposed['ping']!();

    expect(result).toBe('pong');
  });
});

// ─── exposeEventsToRenderer ───────────────────────────────────────────────────

describe('exposeEventsToRenderer', () => {
  it('calls contextBridge.exposeInMainWorld with "events" key by default', () => {
    const events = defineIpcEvents({ ready: () => {} });
    exposeEventsToRenderer(events);

    expect(contextBridge.exposeInMainWorld).toHaveBeenCalledWith('events', expect.any(Object));
  });

  it('accepts a custom window key', () => {
    const events = defineIpcEvents({ ready: () => {} });
    exposeEventsToRenderer(events, 'myEvents');

    expect(contextBridge._exposed.has('myEvents')).toBe(true);
    expect(contextBridge._exposed.has('events')).toBe(false);
  });

  it('exposes a subscription function for each declared channel', () => {
    const events = defineIpcEvents({
      backendReady:   (_code: number) => {},
      folderSelected: (_path: string) => {},
    });
    exposeEventsToRenderer(events);

    const exposed = contextBridge._exposed.get('events')!;
    expect(typeof exposed['backendReady']).toBe('function');
    expect(typeof exposed['folderSelected']).toBe('function');
  });

  it('exposes exactly the declared channels — no extras', () => {
    const events = defineIpcEvents({ ping: () => {} });
    exposeEventsToRenderer(events);

    const exposed = contextBridge._exposed.get('events')!;
    expect(Object.keys(exposed)).toEqual(['ping']);
  });

  it('registers an ipcRenderer.on listener when the subscription function is called', () => {
    const events = defineIpcEvents({ test: (_x: string) => {} });
    exposeEventsToRenderer(events);

    const exposed = contextBridge._exposed.get('events') as Record<string, (cb: () => void) => void>;
    exposed['test']!(vi.fn());

    expect(ipcRenderer.on).toHaveBeenCalledWith('test', expect.any(Function));
  });

  it('strips the IpcRendererEvent and forwards only user args to the callback', () => {
    const events = defineIpcEvents({ test: (_x: string) => {} });
    exposeEventsToRenderer(events);

    const exposed = contextBridge._exposed.get('events') as Record<string, (cb: (x: string) => void) => void>;
    const cb = vi.fn();
    exposed['test']!(cb);

    // Simulate main → renderer push: Electron wraps args as (event, ...userArgs)
    ipcRenderer._emit('test', { sender: null }, 'hello');

    expect(cb).toHaveBeenCalledWith('hello');
    expect(cb).not.toHaveBeenCalledWith(
      expect.objectContaining({ sender: expect.anything() }),
      expect.anything(),
    );
  });

  it('returns an unsubscribe function that calls ipcRenderer.removeListener', () => {
    const events = defineIpcEvents({ test: () => {} });
    exposeEventsToRenderer(events);

    const exposed = contextBridge._exposed.get('events') as Record<string, (cb: () => void) => () => void>;
    const unsub = exposed['test']!(vi.fn());
    unsub();

    expect(ipcRenderer.removeListener).toHaveBeenCalledWith('test', expect.any(Function));
  });

  it('unsubscribed listener is not invoked after unsubscribe', () => {
    const events = defineIpcEvents({ test: () => {} });
    exposeEventsToRenderer(events);

    const exposed = contextBridge._exposed.get('events') as Record<string, (cb: () => void) => () => void>;
    const cb = vi.fn();
    const unsub = exposed['test']!(cb);

    unsub();
    ipcRenderer._emit('test', { sender: null });

    expect(cb).not.toHaveBeenCalled();
  });

  it('multiple subscriptions to the same channel are independent', () => {
    const events = defineIpcEvents({ test: () => {} });
    exposeEventsToRenderer(events);

    const exposed = contextBridge._exposed.get('events') as Record<string, (cb: () => void) => () => void>;
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const unsub1 = exposed['test']!(cb1);
    exposed['test']!(cb2);

    unsub1();
    ipcRenderer._emit('test', { sender: null });

    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).toHaveBeenCalledTimes(1);
  });
});

// ─── exposeValues ─────────────────────────────────────────────────────────────

describe('exposeValues', () => {
  it('exposes the values object under the given key', () => {
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

  it('preserves all properties of the values object', () => {
    exposeValues({ a: true, b: 42, c: 'hello' }, 'cfg');

    const exposed = contextBridge._exposed.get('cfg');
    expect(exposed).toStrictEqual({ a: true, b: 42, c: 'hello' });
  });
});

// ─── exposeDialogsToRenderer ─────────────────────────────────────────────────

describe('exposeDialogsToRenderer', () => {
  it('exposes dialogs API under "dialogs" key by default', () => {
    exposeDialogsToRenderer();

    expect(contextBridge.exposeInMainWorld).toHaveBeenCalledWith('dialogs', expect.any(Object));
  });

  it('accepts custom key and channel prefix', async () => {
    registerDialogHandlers('native-dialog');
    exposeDialogsToRenderer('nativeDialogs', 'native-dialog');

    const exposed = contextBridge._exposed.get('nativeDialogs') as Record<string, (...a: unknown[]) => Promise<unknown>>;
    await exposed['openFile']!({ title: 'Pick one' });

    expect(ipcRenderer.invoke).toHaveBeenCalledWith('native-dialog:open-file', { title: 'Pick one' });
  });

  it('wires all dialog methods to invoke channels', async () => {
    registerDialogHandlers();
    exposeDialogsToRenderer();

    const exposed = contextBridge._exposed.get('dialogs') as Record<string, (...a: unknown[]) => Promise<unknown>>;
    await exposed['openDirectory']!({});
    await exposed['saveFile']!({ defaultPath: 'a.txt' });
    await exposed['messageBox']!({ message: 'Hello' });

    expect(ipcRenderer.invoke).toHaveBeenCalledWith('dialog:open-directory', {});
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('dialog:save-file', { defaultPath: 'a.txt' });
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('dialog:message-box', { message: 'Hello' });
  });
});

// ─── exposeShellToRenderer ───────────────────────────────────────────────────

describe('exposeShellToRenderer', () => {
  it('exposes shell API under "shell" key by default', () => {
    exposeShellToRenderer();

    expect(contextBridge.exposeInMainWorld).toHaveBeenCalledWith('shell', expect.any(Object));
  });

  it('wires openExternal and openPath channels', async () => {
    registerShellHandlers();
    exposeShellToRenderer();

    const exposed = contextBridge._exposed.get('shell') as Record<string, (...a: unknown[]) => Promise<unknown>>;
    await exposed['openExternal']!('https://example.com');
    await exposed['openPath']!('C:/tmp/file.txt');

    expect(ipcRenderer.invoke).toHaveBeenCalledWith('shell:open-external', 'https://example.com');
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('shell:open-path', 'C:/tmp/file.txt');
  });
});
