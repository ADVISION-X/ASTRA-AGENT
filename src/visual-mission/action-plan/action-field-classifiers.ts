const RAW_EXECUTION_ACTION_FIELDS = new Set(["x", "y", "clientX", "clientY"]);
const OWNER_ONLY_ACTION_FIELDS = new Set(["abilityGroupId", "childCapabilityId"]);
const SYSTEM_INJECTED_ACTION_FIELDS = new Set([
  "requestedPlatformId",
  "targetUrl",
  "targetTitle",
  "targetProfileRef",
  "screenshotEvidenceRef",
  "productPresenceAiResultRef",
  "gridSpec",
  "gridSpecRef",
  "coordinateSpace",
  "originalScreenshotRef",
  "coordinateGridScreenshotRef",
  "visualMissionInputRef",
  "platformContextRef",
  "aiResultRef",
]);

export const isRawExecutionActionField = (field: string): boolean => RAW_EXECUTION_ACTION_FIELDS.has(field);

export const isOwnerOnlyActionField = (field: string): boolean => OWNER_ONLY_ACTION_FIELDS.has(field);

export const isSystemInjectedActionField = (field: string): boolean => SYSTEM_INJECTED_ACTION_FIELDS.has(field);