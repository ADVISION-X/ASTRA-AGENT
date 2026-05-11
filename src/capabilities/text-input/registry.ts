import type {
  TextInputChildCapabilityId,
  TextInputChildCapability,
} from "./contract.js";
import { createTypeApprovedTextOnceCapability } from "./children/type-approved-text-once.js";
import { createPressApprovedKeyOnceCapability } from "./children/press-approved-key-once.js";
import { createClearFocusedInputOnceCapability } from "./children/clear-focused-input-once.js";

const CHILDREN = [
  createTypeApprovedTextOnceCapability(),
  createPressApprovedKeyOnceCapability(),
  createClearFocusedInputOnceCapability(),
] as const;

export function createTextInputCapabilityRegistry(): Map<
  TextInputChildCapabilityId,
  TextInputChildCapability
> {
  return new Map(CHILDREN.map((child) => [child.childCapabilityId, child]));
}

export function listTextInputChildren(): TextInputChildCapabilityId[] {
  return CHILDREN.map((child) => child.childCapabilityId);
}
