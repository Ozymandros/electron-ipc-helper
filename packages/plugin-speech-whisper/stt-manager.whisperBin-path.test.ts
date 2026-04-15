// Move this file to the tests/ directory so Vitest will pick it up according to the config patterns.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { STTManager } from './src/stt-manager';
import type { SpeechWhisperOptions } from './src/types';

// Hoisted mock for fs/promises
type AccessMock = ReturnType<typeof vi.fn<[path: string], Promise<void>>> & { binName?: string };
const accessMock = vi.hoisted(() => {
  const fn = vi.fn<[path: string], Promise<void>>((path: string) => {
    if (fn.binName && path === fn.binName) return Promise.resolve();
    if (path.endsWith('.bin')) return Promise.resolve();
    return Promise.reject(new Error('not found'));
  }) as AccessMock;
  return fn;
});

vi.mock('node:fs/promises', () => ({
  access: accessMock,
}));





describe('STTManager (whisperBin in PATH)', () => {
  let options: SpeechWhisperOptions;

  beforeEach(() => {
    accessMock.binName = 'whisper';
    options = {
      whisperBin: 'whisper',
      modelPath: '/some/path/ggml-base.bin',
    };
  });

  it('should report hasBinary: true if whisperBin is in PATH', async () => {
    const stt = new STTManager(options);
    const status = await stt.getStatus();
    expect(status.hasBinary).toBe(true);
  });

  it('should report hasModel: true if modelPath exists', async () => {
    const stt = new STTManager(options);
    const status = await stt.getStatus();
    expect(status.hasModel).toBe(true);
  });

  it('should report canRecord: true if both exist', async () => {
    const stt = new STTManager(options);
    const status = await stt.getStatus();
    expect(status.canRecord).toBe(true);
  });
});

describe('STTManager (whisperBin = "whisper.cmd" in PATH, Windows)', () => {
  let options: SpeechWhisperOptions;

  beforeEach(() => {
    accessMock.binName = 'whisper.cmd';
    options = {
      whisperBin: 'whisper.cmd',
      modelPath: '/some/path/ggml-base.bin',
    };
  });

  it('should report hasBinary: true if whisper.cmd is in PATH', async () => {
    const stt = new STTManager(options);
    const status = await stt.getStatus();
    expect(status.hasBinary).toBe(true);
  });

  it('should report hasModel: true if modelPath exists', async () => {
    const stt = new STTManager(options);
    const status = await stt.getStatus();
    expect(status.hasModel).toBe(true);
  });

  it('should report canRecord: true if both exist', async () => {
    const stt = new STTManager(options);
    const status = await stt.getStatus();
    expect(status.canRecord).toBe(true);
  });
});
