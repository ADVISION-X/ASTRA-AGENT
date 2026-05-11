export const MOUSE_CLICK_LAW_FILE =
  ".github/instructions/cursor-rules/modules/module-mouse-click-capability.instructions.md";

export const MOUSE_CLICK_PRODUCTION_ROOT = "src/capabilities/mouse-click";

/** The three and only registered atomic children. */
export const REQUIRED_CHILD_IDS = [
  "left-click-browser-viewport-once",
  "double-left-click-browser-viewport",
  "right-click-browser-viewport-once",
] as const;

/** Legacy children that must not exist. */
export const FORBIDDEN_CHILD_IDS = [
  "click-browser-coordinate",
  "click-desktop-coordinate",
] as const;

/** Fields that must never appear in mouse-click production source. */
export const FORBIDDEN_FIELDS = [
  "bindingPackageId",
  "bindingPackageVersion",
  "selectedBindingId",
  "bindingVersion",
  "bindingSnapshotRef",
  "mapId",
  "routePlanId",
  "activationId",
  "packageVersion",
  "postActionVerificationRequired",
  "postActionVerificationHandoffRef",
] as const;

/** Max allowed production TS file count. */
export const MAX_PRODUCTION_FILE_COUNT = 20;

export const LAW_IDS = {
  STRUCTURE: "GRASSEYE-MOUSE-CLICK-CAPABILITY-001-V3",
  PROOF: "GRASSEYE-MOUSE-CLICK-CAPABILITY-002-V3",
} as const;
