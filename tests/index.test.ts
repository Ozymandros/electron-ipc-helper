/**
 * Unit tests for the package barrel (`src/index.ts`).
 */

import { describe, it, expect } from 'vitest';
import * as index from '../src/index.js';

describe('index barrel exports', () => {
  it('exports main-process helpers', () => {
    expect(typeof index.defineIpcApi).toBe('function');
    expect(typeof index.defineIpcEvents).toBe('function');
  });
});
