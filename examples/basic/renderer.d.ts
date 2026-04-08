/**
 * Renderer type declarations.
 *
 * Augments the global `Window` interface so the TypeScript compiler knows
 * the types of `window.api`, `window.events`, and `window.meta`.
 *
 * Import this file in your renderer tsconfig `include` array, or
 * add a `/// <reference path="./renderer.d.ts" />` in your renderer entry.
 */

import type { api }    from './api';
import type { events } from './events';
import type {
  ExtractRendererApi,
  ExtractRendererEvents,
} from 'electron-ipc-helper';

declare global {
  interface Window {
    /** Typed request/response API — mirrors the handlers defined in api.ts */
    api: ExtractRendererApi<typeof api>;

    /** Typed push-event subscriptions — mirrors the schema defined in events.ts */
    events: ExtractRendererEvents<typeof events>;

    /** Static app constants exposed by the preload */
    meta: {
      platform:    NodeJS.Platform;
      appVersion:  string;
      nodeVersion: string;
    };
  }
}
