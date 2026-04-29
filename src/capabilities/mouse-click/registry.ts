import type { MouseClickChildCapability, MouseClickChildCapabilityId } from "./contract.js";
import { createClickBrowserCoordinateCapability } from "./children/click-browser-coordinate/implementation.js";
import { createClickDesktopCoordinateCapability } from "./children/click-desktop-coordinate/implementation.js";

const CHILDREN = [
  createClickBrowserCoordinateCapability(),
  createClickDesktopCoordinateCapability(),
] as const;

export function createMouseClickCapabilityRegistry(): Map<MouseClickChildCapabilityId, MouseClickChildCapability> {
  return new Map(CHILDREN.map((child) => [child.childCapabilityId, child]));
}

export function listMouseClickChildren(): MouseClickChildCapabilityId[] {
  return CHILDREN.map((child) => child.childCapabilityId);
}