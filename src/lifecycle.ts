/**
 * @module lifecycle
 *
 * Child process lifecycle helpers for Electron main-process apps.
 */

import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';

export interface ProcessExitInfo {
  code: number | null;
  signal: NodeJS.Signals | null;
}

export interface ChildProcessLifecycleEvents {
  ready: [];
  crashed: [info: ProcessExitInfo];
  failed: [reason: Error];
}

export interface ChildProcessLifecycleOptions {
  command: string;
  args?: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  readyCheck?: () => Promise<void>;
  readyTimeoutMs?: number;
  restartDelayMs?: number;
  maxRestarts?: number;
  rapidRestartWindowMs?: number;
  autoRestart?: boolean;
  forceKillAfterMs?: number;
  spawnOptions?: Omit<SpawnOptions, 'cwd' | 'env'>;
  logger?: Pick<Console, 'warn' | 'error'>;
}

type ListenerMap = {
  [K in keyof ChildProcessLifecycleEvents]: Set<(...args: ChildProcessLifecycleEvents[K]) => void>;
};

const DEFAULT_READY_TIMEOUT_MS = 30_000;
const DEFAULT_RESTART_DELAY_MS = 1_000;
const DEFAULT_MAX_RESTARTS = 5;
const DEFAULT_RAPID_WINDOW_MS = 10_000;
const DEFAULT_FORCE_KILL_AFTER_MS = 1_000;

function createTimeoutError(timeoutMs: number): Error {
  return new Error(`[electron-ipc-helper] Child process readyCheck timed out after ${timeoutMs}ms.`);
}

async function runWithTimeout(task: () => Promise<void>, timeoutMs: number): Promise<void> {
  if (timeoutMs <= 0) {
    await task();
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(createTimeoutError(timeoutMs)), timeoutMs);

    task()
      .then(() => {
        clearTimeout(timer);
        resolve();
      })
      .catch((error: unknown) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export class ChildProcessLifecycle {
  private readonly listeners: ListenerMap = {
    ready: new Set(),
    crashed: new Set(),
    failed: new Set(),
  };

  private child: ChildProcess | null = null;
  private stopping = false;
  private ready = false;
  private restartCount = 0;
  private lastRestartAt = 0;
  private restartTimer: NodeJS.Timeout | null = null;

  constructor(private readonly options: ChildProcessLifecycleOptions) {}

  on<K extends keyof ChildProcessLifecycleEvents>(
    event: K,
    listener: (...args: ChildProcessLifecycleEvents[K]) => void,
  ): () => void {
    this.listeners[event].add(listener);
    return () => {
      this.listeners[event].delete(listener);
    };
  }

  isReady(): boolean {
    return this.ready;
  }

  get pid(): number | undefined {
    return this.child?.pid;
  }

  async start(): Promise<void> {
    if (this.child) {
      return;
    }

    this.stopping = false;
    await this.spawnAndActivate();
  }

  async stop(signal: NodeJS.Signals = 'SIGTERM'): Promise<void> {
    this.stopping = true;
    this.ready = false;

    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }

    const child = this.child;
    this.child = null;
    if (!child) {
      return;
    }

    const forceKillAfterMs = this.options.forceKillAfterMs ?? DEFAULT_FORCE_KILL_AFTER_MS;

    await new Promise<void>((resolve) => {
      let resolved = false;

      const done = (): void => {
        if (resolved) return;
        resolved = true;
        resolve();
      };

      child.once('exit', () => {
        done();
      });

      try {
        child.kill(signal);
      } catch {
        done();
        return;
      }

      if (forceKillAfterMs > 0) {
        const timer = setTimeout(() => {
          if (!child.killed) {
            try {
              child.kill('SIGKILL');
            } catch {
              // no-op
            }
          }
          done();
        }, forceKillAfterMs);
        timer.unref?.();
      }
    });
  }

  private emit<K extends keyof ChildProcessLifecycleEvents>(
    event: K,
    ...args: ChildProcessLifecycleEvents[K]
  ): void {
    for (const listener of this.listeners[event]) {
      listener(...args);
    }
  }

  private async spawnAndActivate(): Promise<void> {
    const child = spawn(
      this.options.command,
      this.options.args ?? [],
      {
        ...this.options.spawnOptions,
        cwd: this.options.cwd,
        env: this.options.env,
      },
    );

    this.child = child;

    child.once('exit', (code, signal) => {
      this.handleUnexpectedExit({ code, signal });
    });

    try {
      if (this.options.readyCheck) {
        await runWithTimeout(
          this.options.readyCheck,
          this.options.readyTimeoutMs ?? DEFAULT_READY_TIMEOUT_MS,
        );
      }
    } catch (error) {
      this.ready = false;
      this.child = null;
      try {
        child.kill('SIGKILL');
      } catch {
        // no-op
      }
      const reason = error instanceof Error ? error : new Error(String(error));
      this.emit('failed', reason);
      throw reason;
    }

    this.ready = true;
    this.restartCount = 0;
    this.emit('ready');
  }

  private handleUnexpectedExit(info: ProcessExitInfo): void {
    if (!this.child) {
      return;
    }

    this.child = null;
    this.ready = false;

    if (this.stopping) {
      return;
    }

    this.emit('crashed', info);

    if (this.options.autoRestart === false) {
      return;
    }

    this.scheduleRestart();
  }

  private scheduleRestart(): void {
    const now = Date.now();
    if (now - this.lastRestartAt < (this.options.rapidRestartWindowMs ?? DEFAULT_RAPID_WINDOW_MS)) {
      this.restartCount += 1;
    } else {
      this.restartCount = 1;
    }
    this.lastRestartAt = now;

    const maxRestarts = this.options.maxRestarts ?? DEFAULT_MAX_RESTARTS;
    if (this.restartCount > maxRestarts) {
      const reason = new Error(
        `[electron-ipc-helper] Child process exceeded max restarts (${maxRestarts}).`,
      );
      this.options.logger?.error?.(reason.message);
      this.emit('failed', reason);
      return;
    }

    const restartDelayMs = this.options.restartDelayMs ?? DEFAULT_RESTART_DELAY_MS;
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      void this.restartAfterCrash();
    }, restartDelayMs);
    this.restartTimer.unref?.();
  }

  private async restartAfterCrash(): Promise<void> {
    if (this.stopping || this.child) {
      return;
    }

    try {
      await this.spawnAndActivate();
    } catch (error) {
      const reason = error instanceof Error ? error : new Error(String(error));
      this.options.logger?.warn?.(
        `[electron-ipc-helper] Restart attempt failed: ${reason.message}`,
      );
      this.scheduleRestart();
    }
  }
}
