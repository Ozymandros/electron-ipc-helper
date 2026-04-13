/**
 * @module menus
 *
 * Declarative Electron menu helpers.
 *
 * This module lets you define menu structure as JSON/YAML, load it from disk,
 * validate the shape, and transform it to Electron menu templates with typed
 * action resolution.
 *
 * ## Action resolution
 *
 * Menu items declare an `actionId` string. At build time, the runtime resolves
 * each `actionId` against an **explicit descriptor registry** (`actions`) rather
 * than guessing from the string value:
 *
 * ```ts
 * buildMenuTemplate(spec.items, {
 *   actions: {
 *     'file.open':   commandAction(() => openFileDialog()),
 *     'file.export': serviceAction(fileService.export),
 *     'app.notify':  emitAction(() => events.emit(win!, 'notified')),
 *   },
 * });
 * ```
 *
 * ### Why explicit descriptors?
 *
 * - No collisions between command names and IPC channel names.
 * - The `kind` field makes the routing decision visible and type-checked.
 * - Unknown `actionId` values are logged as warnings — never silently ignored
 *   when a registry has been provided.
 *
 * ### Anti-pattern warning
 *
 * Do **not** call `ipcMain.handle` channels directly from menu actions.
 * Instead, extract the business logic into a shared service function and call
 * that from both the IPC handler and the `ServiceActionDescriptor`:
 *
 * ```ts
 * // services/fileService.ts
 * export async function openFolder(path: string) { ... }
 *
 * // api.ts — IPC entry point
 * defineIpcApi({ openFolder: fileService.openFolder });
 *
 * // main.ts — menu entry point
 * actions: { 'file.open': serviceAction(() => fileService.openFolder(lastPath)) }
 * ```
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { load as parseYaml } from 'js-yaml';
import { Menu } from 'electron';
import type { MenuItemConstructorOptions } from 'electron';
import type {
  ActionDescriptor,
  ActionRegistry,
  CommandActionDescriptor,
  EmitActionDescriptor,
  ServiceActionDescriptor,
} from './types.js';

type MenuRole = NonNullable<MenuItemConstructorOptions['role']>;

/** Supported file formats for declarative menu specs. */
export type MenuSpecFormat = 'json' | 'yaml';

/**
 * A single declarative menu item.
 *
 * - Use `actionId` to reference a registered `ActionDescriptor`.
 * - Use `role` for built-in Electron menu roles.
 * - Use `submenu` for nested hierarchical menus.
 */
export interface DeclarativeMenuItem {
  id?: string;
  label?: string;
  type?: 'normal' | 'separator' | 'submenu' | 'checkbox' | 'radio';
  role?: MenuRole;
  accelerator?: string;
  enabled?: boolean;
  visible?: boolean;
  checked?: boolean;
  /** Stable identifier resolved against an `ActionRegistry` at click-time. */
  actionId?: string;
  submenu?: DeclarativeMenuItem[];
}

/** Root menu spec object loaded from JSON/YAML. */
export interface DeclarativeMenuSpec {
  items: DeclarativeMenuItem[];
}

/** Loader options for `loadMenuSpecFromFile`. */
export interface LoadMenuSpecOptions {
  format?: MenuSpecFormat;
  encoding?: BufferEncoding;
}

/**
 * Legacy action command lookup.
 * @deprecated Prefer `ActionRegistry` with typed `ActionDescriptor` values.
 */
export type MenuCommandRegistry = Record<string, () => void>;

/** Build options for `buildMenuTemplate`. */
export interface BuildMenuTemplateOptions {
  /**
   * Optional hook called for every activated `actionId`, **before** descriptor
   * resolution. Useful for analytics, logging, or side-channel routing.
   */
  onAction?: (actionId: string) => void;

  /**
   * Typed action descriptor registry.
   *
   * Maps each `actionId` string to an explicit `ActionDescriptor` that declares
   * how the click should be handled (`'command'`, `'service'`, or `'emit'`).
   * Takes **priority** over the legacy `commands` registry when both are provided.
   *
   * @example
   * ```ts
   * actions: {
   *   'file.open':   commandAction(() => openFile()),
   *   'file.export': serviceAction(exportService.run),
   *   'app.notify':  emitAction(() => events.emit(win!, 'notified')),
   * }
   * ```
   */
  actions?: ActionRegistry;

  /**
   * Legacy synchronous command registry.
   * @deprecated Use `actions` with `{ kind: 'command', run }` descriptors.
   *             Will be removed in a future major version.
   */
  commands?: MenuCommandRegistry;
}

// ─── Re-exports ───────────────────────────────────────────────────────────────

export type {
  ActionDescriptor,
  ActionRegistry,
  CommandActionDescriptor,
  EmitActionDescriptor,
  ServiceActionDescriptor,
} from './types.js';

// ─── Factory helpers ──────────────────────────────────────────────────────────

/**
 * Creates a `CommandActionDescriptor` — calls a local function on click.
 *
 * @example
 * ```ts
 * actions: { 'file.new': commandAction(() => createNewDocument()) }
 * ```
 */
export function commandAction(
  run: () => void | Promise<void>,
): CommandActionDescriptor {
  return { kind: 'command', run };
}

/**
 * Creates a `ServiceActionDescriptor` — calls a shared service function on click.
 *
 * Use this when the same function is also invoked via an IPC handler, to keep
 * business logic in one place and avoid duplicating it between the menu and
 * the IPC surface.
 *
 * @example
 * ```ts
 * actions: { 'file.open': serviceAction(fileService.open) }
 * ```
 */
export function serviceAction(
  call: () => void | Promise<void>,
): ServiceActionDescriptor {
  return { kind: 'service', call };
}

/**
 * Creates an `EmitActionDescriptor` — pushes a typed IPC event to a renderer
 * window on click.
 *
 * Provide a zero-arg closure that captures the window reference and calls
 * `events.emit(window, channel, ...args)` with the correct payload.
 *
 * @example
 * ```ts
 * actions: {
 *   'app.notify': emitAction(() => events.emit(mainWindow!, 'notified', 'msg'))
 * }
 * ```
 */
export function emitAction(emit: () => void): EmitActionDescriptor {
  return { kind: 'emit', emit };
}

// ─── Internal resolver ────────────────────────────────────────────────────────

/**
 * Resolves and executes an `ActionDescriptor` based on its `kind`.
 * Async errors from `'command'` and `'service'` descriptors are caught and
 * logged to avoid crashing the main process silently.
 */
function resolveDescriptor(descriptor: ActionDescriptor, actionId: string): void {
  switch (descriptor.kind) {
    case 'command':
      Promise.resolve(descriptor.run()).catch((err: unknown) => {
        console.error(
          `[@ozymandros/electron-message-bridge] Action "${actionId}" (command) threw:`,
          err,
        );
      });
      break;

    case 'service':
      Promise.resolve(descriptor.call()).catch((err: unknown) => {
        console.error(
          `[@ozymandros/electron-message-bridge] Action "${actionId}" (service) threw:`,
          err,
        );
      });
      break;

    case 'emit':
      descriptor.emit();
      break;

    default: {
      // Exhaustive check — TypeScript will error if a new kind is added without
      // a corresponding case above.
      const exhaustive: never = descriptor;
      console.warn(
        '[@ozymandros/electron-message-bridge] Unknown action kind:',
        (exhaustive as { kind: string }).kind,
      );
    }
  }
}

// ─── Validation ───────────────────────────────────────────────────────────────

function inferFormatFromPath(filePath: string): MenuSpecFormat {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.json') return 'json';
  if (ext === '.yaml' || ext === '.yml') return 'yaml';
  throw new TypeError(
    `[@ozymandros/electron-message-bridge] Unsupported menu file extension "${ext}". Use .json, .yaml, or .yml.`,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function validateItem(item: unknown, pathLabel: string): asserts item is DeclarativeMenuItem {
  if (!isRecord(item)) {
    throw new TypeError(`[@ozymandros/electron-message-bridge] ${pathLabel} must be an object.`);
  }

  const type = item['type'];
  if (type !== undefined && typeof type !== 'string') {
    throw new TypeError(`[@ozymandros/electron-message-bridge] ${pathLabel}.type must be a string.`);
  }
  if (type === 'separator') return;

  if (item['label'] !== undefined && typeof item['label'] !== 'string') {
    throw new TypeError(`[@ozymandros/electron-message-bridge] ${pathLabel}.label must be a string.`);
  }
  if (item['id'] !== undefined && typeof item['id'] !== 'string') {
    throw new TypeError(`[@ozymandros/electron-message-bridge] ${pathLabel}.id must be a string.`);
  }
  if (item['role'] !== undefined && typeof item['role'] !== 'string') {
    throw new TypeError(`[@ozymandros/electron-message-bridge] ${pathLabel}.role must be a string.`);
  }
  if (item['accelerator'] !== undefined && typeof item['accelerator'] !== 'string') {
    throw new TypeError(`[@ozymandros/electron-message-bridge] ${pathLabel}.accelerator must be a string.`);
  }
  if (item['enabled'] !== undefined && typeof item['enabled'] !== 'boolean') {
    throw new TypeError(`[@ozymandros/electron-message-bridge] ${pathLabel}.enabled must be a boolean.`);
  }
  if (item['visible'] !== undefined && typeof item['visible'] !== 'boolean') {
    throw new TypeError(`[@ozymandros/electron-message-bridge] ${pathLabel}.visible must be a boolean.`);
  }
  if (item['checked'] !== undefined && typeof item['checked'] !== 'boolean') {
    throw new TypeError(`[@ozymandros/electron-message-bridge] ${pathLabel}.checked must be a boolean.`);
  }
  if (item['actionId'] !== undefined && typeof item['actionId'] !== 'string') {
    throw new TypeError(`[@ozymandros/electron-message-bridge] ${pathLabel}.actionId must be a string.`);
  }
  if (item['submenu'] !== undefined) {
    if (!Array.isArray(item['submenu'])) {
      throw new TypeError(`[@ozymandros/electron-message-bridge] ${pathLabel}.submenu must be an array.`);
    }
    item['submenu'].forEach((child, index) =>
      validateItem(child, `${pathLabel}.submenu[${index}]`),
    );
  }
}

/**
 * Validates and normalizes a raw object into a `DeclarativeMenuSpec`.
 */
export function validateMenuSpec(raw: unknown): DeclarativeMenuSpec {
  if (!isRecord(raw)) {
    throw new TypeError('[@ozymandros/electron-message-bridge] Menu spec root must be an object.');
  }
  const items = raw['items'];
  if (!Array.isArray(items)) {
    throw new TypeError('[@ozymandros/electron-message-bridge] Menu spec root must contain an "items" array.');
  }
  items.forEach((item, index) => validateItem(item, `items[${index}]`));
  return { items: items as DeclarativeMenuItem[] };
}

/**
 * Parses a declarative menu string as JSON or YAML and validates it.
 */
export function parseMenuSpec(content: string, format: MenuSpecFormat): DeclarativeMenuSpec {
  const raw: unknown = format === 'json'
    ? (JSON.parse(content) as unknown)
    : (parseYaml(content) as unknown);
  return validateMenuSpec(raw);
}

/**
 * Loads a declarative menu spec from a JSON/YAML file path.
 */
export async function loadMenuSpecFromFile(
  filePath: string,
  options: LoadMenuSpecOptions = {},
): Promise<DeclarativeMenuSpec> {
  const encoding = options.encoding ?? 'utf8';
  const format = options.format ?? inferFormatFromPath(filePath);
  const fileContent = await readFile(filePath, { encoding });
  return parseMenuSpec(fileContent, format);
}

// ─── Template builder ─────────────────────────────────────────────────────────

function toTemplateItem(
  item: DeclarativeMenuItem,
  options: BuildMenuTemplateOptions,
): MenuItemConstructorOptions {
  if (item.type === 'separator') return { type: 'separator' };

  const templateItem: MenuItemConstructorOptions = {};

  if (item.id !== undefined)          templateItem.id          = item.id;
  if (item.label !== undefined)       templateItem.label       = item.label;
  if (item.type !== undefined)        templateItem.type        = item.type;
  if (item.role !== undefined)        templateItem.role        = item.role;
  if (item.accelerator !== undefined) templateItem.accelerator = item.accelerator;
  if (item.enabled !== undefined)     templateItem.enabled     = item.enabled;
  if (item.visible !== undefined)     templateItem.visible     = item.visible;
  if (item.checked !== undefined)     templateItem.checked     = item.checked;

  if (item.submenu && item.submenu.length > 0) {
    templateItem.submenu = buildMenuTemplate(item.submenu, options);
  }

  if (item.actionId !== undefined) {
    const actionId = item.actionId;

    templateItem.click = (): void => {
      // 1. Generic observer hook — fires first, before any resolution.
      //    Good for analytics, logging, or a global onAction side channel.
      options.onAction?.(actionId);

      // 2. Typed descriptor registry — explicit, kind-checked, takes priority.
      const descriptor = options.actions?.[actionId];
      if (descriptor !== undefined) {
        resolveDescriptor(descriptor, actionId);
        return;
      }

      // 3. Legacy synchronous command registry — backward-compatible fallback.
      const legacyFn = options.commands?.[actionId];
      if (legacyFn !== undefined) {
        legacyFn();
        return;
      }

      // 4. Unknown actionId warning — only when a registry was actually provided,
      //    so purely `onAction`-based setups remain silent.
      if (options.actions !== undefined || options.commands !== undefined) {
        console.warn(
          `[@ozymandros/electron-message-bridge] No action registered for actionId "${actionId}". ` +
          `Add it to the "actions" registry or remove it from the menu spec.`,
        );
      }
    };
  }

  return templateItem;
}

/**
 * Converts declarative items into an Electron `Menu.buildFromTemplate` payload.
 *
 * ### Action resolution order for items with `actionId`
 * 1. `onAction` hook (always fires — good for logging)
 * 2. `actions` descriptor registry (typed, priority)
 * 3. `commands` registry (legacy, backward-compat fallback)
 * 4. Console warning if neither registry contains the `actionId`
 */
export function buildMenuTemplate(
  items: DeclarativeMenuItem[],
  options: BuildMenuTemplateOptions = {},
): MenuItemConstructorOptions[] {
  return items.map((item) => toTemplateItem(item, options));
}

/**
 * Loads a menu spec from disk and applies it as the application menu.
 */
export async function applyApplicationMenuFromFile(
  filePath: string,
  options: LoadMenuSpecOptions & BuildMenuTemplateOptions = {},
): Promise<DeclarativeMenuSpec> {
  const spec = await loadMenuSpecFromFile(filePath, options);
  const template = buildMenuTemplate(spec.items, options);
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  return spec;
}
