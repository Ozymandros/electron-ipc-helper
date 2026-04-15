import { describe, it, expect, vi, beforeEach } from 'vitest';
import { STTManager } from '../src/stt-manager';
import type { SpeechWhisperOptions } from '../src/types';
import { access } from 'node:fs/promises';

vi.mock('node:fs/promises', async () => {
  // Mock access: always succeed for 'whisper', fail for others
  return {
    access: vi.fn((path: string) => {
      if (path === 'whisper') return Promise.resolve();
      if (path.endsWith('.bin')) return Promise.resolve();
      return Promise.reject(new Error('not found'));
    })
  };
});

describe('STTManager (whisperBin in PATH)', () => {
  let options: SpeechWhisperOptions;

  beforeEach(() => {
    options = {
      whisperBin: 'whisper',
      modelPath: '/some/path/ggml-base.bin',
    };
  });

  it('should report hasBinary: true if whisperBin is in PATH', async () => {
    const stt = new STTManager(options);
    const status = await stt.getStatus();
    expect(status.hasBinary).toBe(true);
    expect(status.error).toBeUndefined();
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
