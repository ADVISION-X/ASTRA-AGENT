import type { MouseClickChildCapabilityId, MouseClickChildCapability } from "./contract.js";
import { createLeftClickBrowserViewportOnceCapability } from "./children/left-click-browser-viewport-once.js";
import { createDoubleLeftClickBrowserViewportCapability } from "./children/double-left-click-browser-viewport.js";
import { createRightClickBrowserViewportOnceCapability } from "./children/right-click-browser-viewport-once.js";

const CHILDREN = [
  createLeftClickBrowserViewportOnceCapability(),
  createDoubleLeftClickBrowserViewportCapability(),
  createRightClickBrowserViewportOnceCapability(),
] as const;

export function createMouseClickCapabilityRegistry(): Map<MouseClickChildCapabilityId, MouseClickChildCapability> {
  return new Map(CHILDREN.map((child) => [child.childCapabilityId, child]));
}

export function listMouseClickChildren(): MouseClickChildCapabilityId[] {
  return CHILDREN.map((child) => child.childCapabilityId);
}
