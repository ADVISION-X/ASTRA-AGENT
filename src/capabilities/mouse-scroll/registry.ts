import type { MouseScrollChildCapability, MouseScrollChildCapabilityId } from "./contract.js";
import { createScrollBrowserViewportCapability } from "./children/scroll-browser-viewport/implementation.js";
import { createScrollDesktopScreenCapability } from "./children/scroll-desktop-screen/implementation.js";
import { createScrollRegionCapability } from "./children/scroll-region/implementation.js";

export function createMouseScrollCapabilityRegistry(): Map<MouseScrollChildCapabilityId, MouseScrollChildCapability> {
  return new Map<MouseScrollChildCapabilityId, MouseScrollChildCapability>([
    ["scroll-browser-viewport", createScrollBrowserViewportCapability()],
    ["scroll-desktop-screen", createScrollDesktopScreenCapability()],
    ["scroll-region", createScrollRegionCapability()],
  ]);
}