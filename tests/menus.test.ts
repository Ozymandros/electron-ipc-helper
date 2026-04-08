/**
 * Unit tests for declarative menus helpers.
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { vi } from 'vitest';
import { beforeEach, describe, expect, it } from 'vitest';
import { Menu, resetMocks } from './__mocks__/electron.js';
import {
  applyApplicationMenuFromFile,
  buildMenuTemplate,
  commandAction,
  emitAction,
  loadMenuSpecFromFile,
  parseMenuSpec,
  serviceAction,
  validateMenuSpec,
} from '../src/menus.js';

beforeEach(() => {
  resetMocks();
});

describe('validateMenuSpec', () => {
  it('accepts a valid root object with items', () => {
    const spec = validateMenuSpec({
      items: [{ label: 'File', submenu: [{ label: 'Open', actionId: 'file.open' }] }],
    });

    expect(spec.items).toHaveLength(1);
  });

  it('throws on non-object root', () => {
    expect(() => validateMenuSpec('bad')).toThrow('Menu spec root must be an object');
  });

  it('throws when items is missing', () => {
    expect(() => validateMenuSpec({})).toThrow('must contain an "items" array');
  });

  it('throws for invalid item field types', () => {
    expect(() => validateMenuSpec({ items: [{ type: 123 }] })).toThrow('.type must be a string');
    expect(() => validateMenuSpec({ items: [{ label: 123 }] })).toThrow('.label must be a string');
    expect(() => validateMenuSpec({ items: [{ id: 123 }] })).toThrow('.id must be a string');
    expect(() => validateMenuSpec({ items: [{ role: 123 }] })).toThrow('.role must be a string');
    expect(() => validateMenuSpec({ items: [{ accelerator: 123 }] })).toThrow('.accelerator must be a string');
    expect(() => validateMenuSpec({ items: [{ enabled: 'yes' }] })).toThrow('.enabled must be a boolean');
    expect(() => validateMenuSpec({ items: [{ visible: 'yes' }] })).toThrow('.visible must be a boolean');
    expect(() => validateMenuSpec({ items: [{ checked: 'yes' }] })).toThrow('.checked must be a boolean');
    expect(() => validateMenuSpec({ items: [{ actionId: 123 }] })).toThrow('.actionId must be a string');
    expect(() => validateMenuSpec({ items: [{ submenu: 'nope' }] })).toThrow('.submenu must be an array');
  });
});

describe('parseMenuSpec', () => {
  it('parses JSON content', () => {
    const spec = parseMenuSpec(
      JSON.stringify({ items: [{ label: 'Help', actionId: 'help.open' }] }),
      'json',
    );

    expect(spec.items[0]?.label).toBe('Help');
  });

  it('parses YAML content', () => {
    const spec = parseMenuSpec(
      'items:\n  - label: File\n    submenu:\n      - label: Exit\n        role: quit\n',
      'yaml',
    );

    expect(spec.items[0]?.submenu?.[0]?.role).toBe('quit');
  });
});

describe('loadMenuSpecFromFile', () => {
  it('loads JSON by file extension', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'ipc-helper-menu-'));

    try {
      const filePath = path.join(tempDir, 'menu.json');
      await writeFile(filePath, '{"items":[{"label":"View"}]}', 'utf8');

      const spec = await loadMenuSpecFromFile(filePath);
      expect(spec.items[0]?.label).toBe('View');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('loads YAML by file extension', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'ipc-helper-menu-'));

    try {
      const filePath = path.join(tempDir, 'menu.yaml');
      await writeFile(filePath, 'items:\n  - label: Window\n', 'utf8');

      const spec = await loadMenuSpecFromFile(filePath);
      expect(spec.items[0]?.label).toBe('Window');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('throws for unsupported file extension', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'ipc-helper-menu-'));

    try {
      const filePath = path.join(tempDir, 'menu.txt');
      await writeFile(filePath, '{}', 'utf8');

      await expect(loadMenuSpecFromFile(filePath)).rejects.toThrow('Unsupported menu file extension');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

describe('buildMenuTemplate', () => {
  it('creates click handlers from actionId', () => {
    const onActionCalls: string[] = [];

    const template = buildMenuTemplate(
      [
        { label: 'File', submenu: [{ label: 'Open', actionId: 'file.open' }] },
        { type: 'separator' },
      ],
      { onAction: (actionId: string) => onActionCalls.push(actionId) },
    );

    const openItem = (template[0]?.submenu as unknown[])?.[0] as { click?: () => void };
    openItem.click?.();

    expect(onActionCalls).toEqual(['file.open']);
    expect(template[1]).toEqual({ type: 'separator' });
  });

  it('supports commands registry without onAction', () => {
    const openCommand = vi.fn();

    const template = buildMenuTemplate(
      [{ label: 'Open', actionId: 'file.open' }],
      {
        commands: {
          'file.open': openCommand,
        },
      },
    );

    const openItem = template[0] as { click?: () => void };
    openItem.click?.();

    expect(openCommand).toHaveBeenCalledTimes(1);
  });

  it('runs onAction and commands in order', () => {
    const order: string[] = [];

    const template = buildMenuTemplate(
      [{ label: 'Open', actionId: 'file.open' }],
      {
        onAction: () => order.push('onAction'),
        commands: {
          'file.open': () => order.push('command'),
        },
      },
    );

    const openItem = template[0] as { click?: () => void };
    openItem.click?.();

    expect(order).toEqual(['onAction', 'command']);
  });
});

describe('applyApplicationMenuFromFile', () => {
  it('loads, builds and applies the application menu', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'ipc-helper-menu-'));

    try {
      const filePath = path.join(tempDir, 'menu.yml');
      await writeFile(filePath, 'items:\n  - label: Help\n    actionId: help.open\n', 'utf8');

      const spec = await applyApplicationMenuFromFile(filePath);

      expect(spec.items[0]?.label).toBe('Help');
      expect(Menu.buildFromTemplate).toHaveBeenCalledTimes(1);
      expect(Menu.setApplicationMenu).toHaveBeenCalledTimes(1);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

// ─── Typed action descriptors ─────────────────────────────────────────────────

describe('buildMenuTemplate — actions registry', () => {
  /** Helper: get the click handler for the first item in a built template. */
  function firstClick(items: ReturnType<typeof buildMenuTemplate>): (() => void) | undefined {
    return (items[0] as { click?: () => void } | undefined)?.click;
  }

  it('calls run() for a command descriptor', () => {
    const run = vi.fn();
    const template = buildMenuTemplate(
      [{ label: 'New', actionId: 'file.new' }],
      { actions: { 'file.new': commandAction(run) } },
    );
    firstClick(template)?.();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('calls call() for a service descriptor', () => {
    const call = vi.fn();
    const template = buildMenuTemplate(
      [{ label: 'Export', actionId: 'file.export' }],
      { actions: { 'file.export': serviceAction(call) } },
    );
    firstClick(template)?.();
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('calls emit() for an emit descriptor', () => {
    const emit = vi.fn();
    const template = buildMenuTemplate(
      [{ label: 'Notify', actionId: 'app.notify' }],
      { actions: { 'app.notify': emitAction(emit) } },
    );
    firstClick(template)?.();
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it('actions registry takes priority over legacy commands', () => {
    const descriptorRun  = vi.fn();
    const legacyCommand  = vi.fn();

    const template = buildMenuTemplate(
      [{ label: 'Open', actionId: 'file.open' }],
      {
        actions:  { 'file.open': commandAction(descriptorRun) },
        commands: { 'file.open': legacyCommand },
      },
    );
    firstClick(template)?.();

    expect(descriptorRun).toHaveBeenCalledTimes(1);
    expect(legacyCommand).not.toHaveBeenCalled();
  });

  it('falls back to legacy commands when no descriptor matches the actionId', () => {
    const legacyCommand = vi.fn();

    const template = buildMenuTemplate(
      [{ label: 'Open', actionId: 'file.open' }],
      {
        actions:  {},   // registry provided but this actionId is absent
        commands: { 'file.open': legacyCommand },
      },
    );
    firstClick(template)?.();

    expect(legacyCommand).toHaveBeenCalledTimes(1);
  });

  it('fires onAction before the descriptor is resolved', () => {
    const order: string[] = [];

    const template = buildMenuTemplate(
      [{ label: 'Open', actionId: 'file.open' }],
      {
        onAction: () => order.push('onAction'),
        actions: {
          'file.open': commandAction(() => { order.push('descriptor'); }),
        },
      },
    );
    firstClick(template)?.();

    expect(order).toEqual(['onAction', 'descriptor']);
  });

  it('fires onAction before the legacy command fallback', () => {
    const order: string[] = [];

    const template = buildMenuTemplate(
      [{ label: 'Open', actionId: 'file.open' }],
      {
        onAction:  () => order.push('onAction'),
        commands:  { 'file.open': () => order.push('command') },
      },
    );
    firstClick(template)?.();

    expect(order).toEqual(['onAction', 'command']);
  });

  it('warns when actionId is absent from a provided actions registry', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const template = buildMenuTemplate(
      [{ label: 'Unknown', actionId: 'missing.action' }],
      { actions: {} },
    );
    firstClick(template)?.();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('missing.action'),
    );
    warnSpy.mockRestore();
  });

  it('warns when actionId is absent from a provided commands registry', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const template = buildMenuTemplate(
      [{ label: 'Unknown', actionId: 'missing.action' }],
      { commands: {} },
    );
    firstClick(template)?.();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('missing.action'),
    );
    warnSpy.mockRestore();
  });

  it('does NOT warn when no registries are provided (onAction-only setup)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const template = buildMenuTemplate(
      [{ label: 'Something', actionId: 'some.action' }],
      { onAction: vi.fn() },
    );
    firstClick(template)?.();

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('logs command descriptor errors', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const template = buildMenuTemplate(
      [{ label: 'Broken', actionId: 'broken.command' }],
      {
        actions: {
          'broken.command': commandAction(async () => {
            throw new Error('command failure');
          }),
        },
      },
    );

    firstClick(template)?.();
    await Promise.resolve();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('broken.command'),
      expect.any(Error),
    );
    errorSpy.mockRestore();
  });

  it('logs service descriptor errors', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const template = buildMenuTemplate(
      [{ label: 'Broken', actionId: 'broken.service' }],
      {
        actions: {
          'broken.service': serviceAction(async () => {
            throw new Error('service failure');
          }),
        },
      },
    );

    firstClick(template)?.();
    await Promise.resolve();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('broken.service'),
      expect.any(Error),
    );
    errorSpy.mockRestore();
  });
});

// ─── Factory helpers ──────────────────────────────────────────────────────────

describe('commandAction factory', () => {
  it('returns a CommandActionDescriptor with kind "command"', () => {
    const run = vi.fn();
    const descriptor = commandAction(run);

    expect(descriptor.kind).toBe('command');
    expect(descriptor.run).toBe(run);
  });

  it('descriptor is directly invokable', () => {
    const run = vi.fn();
    commandAction(run).run();
    expect(run).toHaveBeenCalledTimes(1);
  });
});

describe('serviceAction factory', () => {
  it('returns a ServiceActionDescriptor with kind "service"', () => {
    const call = vi.fn();
    const descriptor = serviceAction(call);

    expect(descriptor.kind).toBe('service');
    expect(descriptor.call).toBe(call);
  });

  it('descriptor is directly invokable', () => {
    const call = vi.fn();
    serviceAction(call).call();
    expect(call).toHaveBeenCalledTimes(1);
  });
});

describe('emitAction factory', () => {
  it('returns an EmitActionDescriptor with kind "emit"', () => {
    const emit = vi.fn();
    const descriptor = emitAction(emit);

    expect(descriptor.kind).toBe('emit');
    expect(descriptor.emit).toBe(emit);
  });

  it('descriptor is directly invokable', () => {
    const emit = vi.fn();
    emitAction(emit).emit();
    expect(emit).toHaveBeenCalledTimes(1);
  });
});
