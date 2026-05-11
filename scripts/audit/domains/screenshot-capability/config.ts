// Screenshot Capability Inspector — config
// Checks the 9 governance questions defined in the law.

export const SCREENSHOT_SOURCE_DIR = "src/capabilities/screenshot";
export const SCREENSHOT_AUDIT_DIR = "scripts/audit/domains/screenshot-capability";

export const SCREENSHOT_MAX_SOURCE_FILES = 20;
export const SCREENSHOT_MAX_AUDIT_FILES = 3;

export const SCREENSHOT_REQUIRED_CHILDREN = [
  "capture-browser-viewport",
  "capture-grid-region",
  "render-coordinate-grid",
] as const;

export const SCREENSHOT_FORBIDDEN_CHILDREN = [
  "capture-desktop-screen",
  "prepare-ai-input",
  "prepare-visual-mission-input",
  "optimize-lossless",
] as const;

export const SCREENSHOT_FORBIDDEN_FIELDS = [
  "pageState",
  "page-state",
  "visualTarget",
  "visual-target",
  "postActionVerification",
  "PAV",
  "targetCandidate",
  "productPresence",
  "pagePreparation",
  "commentCleanup",
  "nextItemVerification",
  "businessTruth",
  "targetTruth",
  "imageMeaning",
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
  "deterministicFlow",
] as const;

export const SCREENSHOT_FORBIDDEN_EXECUTABLE_COORDS = [
  "clientX",
  "clientY",
  "executableX",
  "executableY",
  "clickPoint",
  "normalizedClickPoint",
  "browserCoordinate",
] as const;

export const SCREENSHOT_FORBIDDEN_IMPORTS = [
  "capabilities/ai",
  "geometry-guard/runtime",
  "mouse-click/runtime",
  "mouse-scroll/runtime",
  "orchestration/runtime",
  "forensics-persistence/runtime",
] as const;

export const SCREENSHOT_FORBIDDEN_PROOF_CLAIMS = [
  "business success",
  "AI correctness",
  "target truth",
  "page state truth",
  "click success",
  "geometry safety",
  "PAV truth",
  "prompt readiness",
] as const;
