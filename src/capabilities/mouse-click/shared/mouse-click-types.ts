import { createHash } from "node:crypto";

export const MOUSE_CLICK_ABILITY_GROUP_ID = "mouse-click";
export const MOUSE_CLICK_CHILD_CAPABILITY_IDS = ["click-browser-coordinate", "click-desktop-coordinate"] as const;
export const MOUSE_CLICK_COORDINATE_SPACES = ["browserViewport", "desktopScreen"] as const;
export const MOUSE_CLICK_BUTTONS = ["left", "right"] as const;
export const MOUSE_CLICK_COUNTS = [1, 2] as const;

export function buildStableMouseClickRef(prefix: string, parts: Array<string | number | null | undefined>): string {
  const digest = createHash("sha256").update(JSON.stringify([prefix, ...parts])).digest("hex").slice(0, 18);
  return `${prefix}:${digest}`;
}