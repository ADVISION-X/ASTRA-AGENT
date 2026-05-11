export const TEXT_INPUT_LAW_FILE =
  ".github/instructions/cursor-rules/modules/module-text-input-capability.instructions.md";

export const TEXT_INPUT_PRODUCTION_ROOT = "src/capabilities/text-input";

/** The three and only registered atomic children. */
export const REQUIRED_CHILD_IDS = [
  "type-approved-text-once",
  "press-approved-key-once",
  "clear-focused-input-once",
] as const;

/** Retired children that must not exist. */
export const FORBIDDEN_CHILD_IDS = [
  "paste-text",
  "replace-input",
  "commit-input",
  "press-navigation-key",
] as const;

/** Fields that must never appear in text-input production source. */
export const FORBIDDEN_FIELDS = [
  "mapId",
  "runtimePlanId",
  "routePlanId",
  "activationId",
  "templateId",
  "selectedMapId",
  "bindingPackageId",
  "bindingPackageVersion",
  "selectedBindingId",
  "bindingVersion",
  "bindingSnapshotRef",
  "branchToken",
  "deterministicFlowPlan",
  "postActionVerificationRequired",
  "postActionVerificationHandoffRef",
  "pageReady",
  "pageCorrect",
  "actionVerified",
  "semanticSuccess",
  "generatedText",
  "textGenerationPrompt",
  "domSelector",
  "rawBrowserCommand",
  "clipboardContent",
  "clipboardPort",
  "clipboard",
] as const;

/** Forbidden file patterns that must not exist inside production root. */
export const FORBIDDEN_FILE_PATTERNS = [
  "paste",
  "replace-input",
  "commit-input",
  "navigation-key",
  "clipboard",
  "pav",
  "post-action",
  "focus-proof",
  "input-target-proof",
  "text-source-proof",
] as const;

/** Primitive port methods that are the ONLY allowed ones. */
export const REQUIRED_PORT_METHODS = ["typeText", "pressKey", "clearFocusedInput"] as const;

/** Primitive port methods that must NOT exist. */
export const FORBIDDEN_PORT_METHODS = ["paste", "replace", "commit"] as const;

/** Max allowed production file count. */
export const MAX_PRODUCTION_FILE_COUNT = 14;

export const LAW_IDS = {
  STRUCTURE: "GRASSEYE-TEXT-INPUT-CAPABILITY-001-V2",
  PROOF: "GRASSEYE-TEXT-INPUT-CAPABILITY-002-V2",
} as const;
