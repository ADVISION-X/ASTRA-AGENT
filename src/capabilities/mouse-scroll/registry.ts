import type { MouseScrollChildCapabilityId } from "./contract.js";
import { createScrollBrowserViewportCapability } from "./children/scroll-browser-viewport/implementation.js";
import { createScrollDesktopScreenCapability } from "./children/scroll-desktop-screen/implementation.js";
import { createScrollRegionCapability } from "./children/scroll-region/implementation.js";
import type { MouseScrollChildCapability } from "./runtime/mouse-scroll-runtime-context.js";

const CHILDREN = [
  createScrollBrowserViewportCapability(),
  createScrollDesktopScreenCapability(),
  createScrollRegionCapability(),
] as const;

export function createMouseScrollCapabilityRegistry(): Map<MouseScrollChildCapabilityId, MouseScrollChildCapability> {
  return new Map(CHILDREN.map((child) => [child.childCapabilityId, child]));
}

export function listMouseScrollChildren(): MouseScrollChildCapabilityId[] {
  return CHILDREN.map((child) => child.childCapabilityId);
}