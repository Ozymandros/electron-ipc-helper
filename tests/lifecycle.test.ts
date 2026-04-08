/**
 * Unit tests for child process lifecycle helpers.
 */

import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChildProcessLifecycle } from '../src/lifecycle.js';

const { spawnMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
}));

class FakeChildProcess extends EventEmitter {
  killed = false;
  pid = 4242;

  kill(_signal?: NodeJS.Signals): boolean {
    this.killed = true;
    this.emit('exit', 0, null);
    return true;
  }
}

class HangingChildProcess extends EventEmitter {
  killed = false;
  pid = 4343;
  signals: NodeJS.Signals[] = [];

  kill(signal: NodeJS.Signals = 'SIGTERM'): boolean {
    this.signals.push(signal);
    if (signal === 'SIGKILL') {
      this.killed = true;
    }
    return true;
  }
}

vi.mock('node:child_process', () => ({
  spawn: spawnMock,
}));

describe('ChildProcessLifecycle', () => {
  beforeEach(() => {
    spawnMock.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits ready after start', async () => {
    const child = new FakeChildProcess();
    spawnMock.mockReturnValue(child);

    const lifecycle = new ChildProcessLifecycle({
      command: 'node',
    });

    const onReady = vi.fn();
    lifecycle.on('ready', onReady);

    await lifecycle.start();

    expect(onReady).toHaveBeenCalledTimes(1);
    expect(lifecycle.isReady()).toBe(true);
    expect(lifecycle.pid).toBe(4242);
    expect(spawnMock).toHaveBeenCalledTimes(1);
  });

  it('does not spawn twice when start is called repeatedly', async () => {
    const child = new FakeChildProcess();
    spawnMock.mockReturnValue(child);

    const lifecycle = new ChildProcessLifecycle({ command: 'node' });

    await lifecycle.start();
    await lifecycle.start();

    expect(spawnMock).toHaveBeenCalledTimes(1);
  });

  it('stop is a no-op when process is not running', async () => {
    const lifecycle = new ChildProcessLifecycle({ command: 'node' });
    await expect(lifecycle.stop()).resolves.toBeUndefined();
  });

  it('waits for readyCheck and supports stop', async () => {
    const child = new FakeChildProcess();
    spawnMock.mockReturnValue(child);

    const readyCheck = vi.fn(async () => {});

    const lifecycle = new ChildProcessLifecycle({
      command: 'node',
      readyCheck,
      readyTimeoutMs: 100,
    });

    await lifecycle.start();
    await lifecycle.stop();

    expect(readyCheck).toHaveBeenCalledTimes(1);
    expect(child.killed).toBe(true);
    expect(lifecycle.isReady()).toBe(false);
  });

  it('restarts after unexpected exit and emits crashed', async () => {
    const child1 = new FakeChildProcess();
    const child2 = new FakeChildProcess();
    spawnMock.mockReturnValueOnce(child1).mockReturnValueOnce(child2);

    const lifecycle = new ChildProcessLifecycle({
      command: 'node',
      restartDelayMs: 10,
    });

    const onCrashed = vi.fn();
    const onReady = vi.fn();
    lifecycle.on('crashed', onCrashed);
    lifecycle.on('ready', onReady);

    await lifecycle.start();
    child1.emit('exit', 1, null);

    await vi.advanceTimersByTimeAsync(20);

    expect(onCrashed).toHaveBeenCalledTimes(1);
    expect(onReady).toHaveBeenCalledTimes(2);
    expect(spawnMock).toHaveBeenCalledTimes(2);
    expect(lifecycle.isReady()).toBe(true);
  });

  it('does not restart when autoRestart is false', async () => {
    const child = new FakeChildProcess();
    spawnMock.mockReturnValue(child);

    const lifecycle = new ChildProcessLifecycle({
      command: 'node',
      autoRestart: false,
      restartDelayMs: 1,
    });

    await lifecycle.start();
    child.emit('exit', 1, null);
    await vi.advanceTimersByTimeAsync(10);

    expect(spawnMock).toHaveBeenCalledTimes(1);
    expect(lifecycle.isReady()).toBe(false);
  });

  it('emits failed after exceeding restart limit', async () => {
    const child1 = new FakeChildProcess();
    spawnMock.mockReturnValueOnce(child1);

    const lifecycle = new ChildProcessLifecycle({
      command: 'node',
      restartDelayMs: 1,
      maxRestarts: 0,
      rapidRestartWindowMs: 1_000,
    });

    const onFailed = vi.fn();
    lifecycle.on('failed', onFailed);

    await lifecycle.start();
    child1.emit('exit', 1, null);
    await vi.advanceTimersByTimeAsync(5);

    expect(onFailed).toHaveBeenCalledTimes(1);
    expect(lifecycle.isReady()).toBe(false);
  });

  it('times out when readyCheck does not resolve', async () => {
    const child = new FakeChildProcess();
    spawnMock.mockReturnValue(child);

    const lifecycle = new ChildProcessLifecycle({
      command: 'node',
      readyCheck: async () => {
        await new Promise(() => {});
      },
      readyTimeoutMs: 10,
    });

    const startPromise = lifecycle.start();
    const captured = startPromise.catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(15);

    const error = await captured;
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('readyCheck timed out');
    expect(lifecycle.isReady()).toBe(false);
  });

  it('normalizes non-Error readyCheck failures', async () => {
    const child = new FakeChildProcess();
    spawnMock.mockReturnValue(child);

    const lifecycle = new ChildProcessLifecycle({
      command: 'node',
      readyCheck: async () => {
        throw 'boom';
      },
      readyTimeoutMs: 50,
    });

    const error = await lifecycle.start().catch((err: unknown) => err);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('boom');
  });

  it('uses force-kill timeout path when child does not exit', async () => {
    const child = new HangingChildProcess();
    spawnMock.mockReturnValue(child);

    const lifecycle = new ChildProcessLifecycle({
      command: 'node',
      forceKillAfterMs: 5,
    });

    await lifecycle.start();
    const stopPromise = lifecycle.stop();
    await vi.advanceTimersByTimeAsync(10);
    await stopPromise;

    expect(child.signals).toEqual(['SIGTERM', 'SIGKILL']);
  });

  it('logs and emits failed when restart limit is exceeded', async () => {
    const child = new FakeChildProcess();
    spawnMock.mockReturnValueOnce(child);

    const logger = {
      warn: vi.fn(),
      error: vi.fn(),
    };

    const lifecycle = new ChildProcessLifecycle({
      command: 'node',
      maxRestarts: 0,
      restartDelayMs: 1,
      logger,
    });

    const onFailed = vi.fn();
    lifecycle.on('failed', onFailed);

    await lifecycle.start();
    child.emit('exit', 1, null);
    await vi.advanceTimersByTimeAsync(5);

    expect(onFailed).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('logs warn when restart attempt fails', async () => {
    const child1 = new FakeChildProcess();
    const child2 = new FakeChildProcess();
    spawnMock.mockReturnValueOnce(child1).mockReturnValueOnce(child2);

    let failReadyCheck = false;

    const logger = {
      warn: vi.fn(),
      error: vi.fn(),
    };

    const lifecycle = new ChildProcessLifecycle({
      command: 'node',
      logger,
      restartDelayMs: 1,
      maxRestarts: 1,
      readyCheck: async () => {
        if (failReadyCheck) {
          throw new Error('restart probe failed');
        }
      },
    });

    await lifecycle.start();

    failReadyCheck = true;
    child1.emit('exit', 1, null);
    await vi.advanceTimersByTimeAsync(20);

    expect(logger.warn).toHaveBeenCalled();
  });

  it('supports listener unsubscription', async () => {
    const child = new FakeChildProcess();
    spawnMock.mockReturnValue(child);

    const lifecycle = new ChildProcessLifecycle({ command: 'node' });
    const onReady = vi.fn();
    const off = lifecycle.on('ready', onReady);
    off();

    await lifecycle.start();

    expect(onReady).not.toHaveBeenCalled();
  });
});
