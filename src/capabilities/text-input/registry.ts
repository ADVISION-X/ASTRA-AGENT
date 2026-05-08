import type { TextInputChildCapabilityId } from "./contract.js";
import type { TextInputChildCapability } from "./runtime/text-input-child-capability.js";
import { createClearInputCapability } from "./children/clear-input/implementation.js";
import { createCommitInputCapability } from "./children/commit-input/implementation.js";
import { createPasteTextCapability } from "./children/paste-text/implementation.js";
import { createPressKeyCapability } from "./children/press-key/implementation.js";
import { createPressNavigationKeyCapability } from "./children/press-navigation-key/implementation.js";
import { createReplaceInputCapability } from "./children/replace-input/implementation.js";
import { createTypeTextCapability } from "./children/type-text/implementation.js";

const CHILDREN = [
  createTypeTextCapability(),
  createPasteTextCapability(),
  createClearInputCapability(),
  createReplaceInputCapability(),
  createPressKeyCapability(),
  createPressNavigationKeyCapability(),
  createCommitInputCapability(),
] as const;

export function createTextInputCapabilityRegistry(): Map<TextInputChildCapabilityId, TextInputChildCapability> {
  return new Map(CHILDREN.map((child) => [child.childCapabilityId, child]));
}

export function listTextInputChildren(): TextInputChildCapabilityId[] {
  return CHILDREN.map((child) => child.childCapabilityId);
}