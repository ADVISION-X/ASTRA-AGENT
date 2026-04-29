import { createHash } from "node:crypto";

export const MOUSE_SCROLL_ABILITY_GROUP_ID = "mouse-scroll";
export const MOUSE_SCROLL_CHILD_CAPABILITY_IDS = [
  "scroll-browser-viewport",
  "scroll-desktop-screen",
  "scroll-region",
] as const;
export const MOUSE_SCROLL_COORDINATE_SPACES = ["browserViewport", "desktopScreen"] as const;
export const MOUSE_SCROLL_DIRECTIONS = ["up", "down", "left", "right"] as const;
export const MOUSE_SCROLL_MAGNITUDES = ["small", "halfPage", "onePage", "twoPages", "customDelta"] as const;

export function buildStableMouseScrollRef(prefix: string, parts: readonly unknown[]): string {
  const hash = createHash("sha1")
    .update(
      JSON.stringify(
        parts.map((part) => {
          if (part === undefined) {
            return null;
          }
          return part;
        }),
      ),
    )
    .digest("hex")
    .slice(0, 16);

  return `${prefix}:${hash}`;
}