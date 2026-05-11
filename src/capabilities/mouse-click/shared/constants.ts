import { createHash } from "node:crypto";

export const MOUSE_CLICK_ABILITY_GROUP_ID = "mouse-click" as const;

export const MOUSE_CLICK_CHILD_CAPABILITY_IDS = [
  "left-click-browser-viewport-once",
  "double-left-click-browser-viewport",
  "right-click-browser-viewport-once",
] as const;

export type MouseClickChildCapabilityId = (typeof MOUSE_CLICK_CHILD_CAPABILITY_IDS)[number];

/** Fixed button per child — never exposed to AI or external input. */
export const MOUSE_CLICK_BUTTON_MAP = {
  "left-click-browser-viewport-once": "left",
  "double-left-click-browser-viewport": "left",
  "right-click-browser-viewport-once": "right",
} as const satisfies Record<MouseClickChildCapabilityId, "left" | "right">;

/** Fixed click count per child — never exposed to AI or external input. */
export const MOUSE_CLICK_COUNT_MAP = {
  "left-click-browser-viewport-once": 1,
  "double-left-click-browser-viewport": 2,
  "right-click-browser-viewport-once": 1,
} as const satisfies Record<MouseClickChildCapabilityId, 1 | 2>;

export function buildMouseClickRef(prefix: string, parts: readonly unknown[]): string {
  const hash = createHash("sha1")
    .update(JSON.stringify(parts.map((p) => (p === undefined ? null : p))))
    .digest("hex")
    .slice(0, 16);
  return `${prefix}:${hash}`;
}
