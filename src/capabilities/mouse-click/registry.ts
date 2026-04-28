import type { MouseClickChildCapability, MouseClickChildCapabilityId } from "./contract.js";
import { createClickBrowserCoordinateCapability } from "./children/click-browser-coordinate/implementation.js";
import { createClickDesktopCoordinateCapability } from "./children/click-desktop-coordinate/implementation.js";

export function createMouseClickCapabilityRegistry(): Map<MouseClickChildCapabilityId, MouseClickChildCapability> {
  return new Map<MouseClickChildCapabilityId, MouseClickChildCapability>([
    ["click-browser-coordinate", createClickBrowserCoordinateCapability()],
    ["click-desktop-coordinate", createClickDesktopCoordinateCapability()],
  ]);
}