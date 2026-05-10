import type { AtomicMuscleMemoryEntry } from "../../muscle-memory/catalog/muscle-memory-catalog.schema.js";

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
  "pageStateRef",
  "coordinateSpace",
  "originalScreenshotRef",
  "coordinateGridScreenshotRef",
  "visualMissionInputRef",
  "platformContextRef",
  "aiResultRef",
]);

const EXTRA_AI_VISIBLE_FIELDS_BY_ACTION_CODE: Partial<Record<string, readonly string[]>> = {
  CLICK_CELL: ["targetName"],
};

export const isRawExecutionActionField = (field: string): boolean => RAW_EXECUTION_ACTION_FIELDS.has(field);

export const isSystemInjectedActionField = (field: string): boolean => SYSTEM_INJECTED_ACTION_FIELDS.has(field);

export const isAiForbiddenActionField = (field: string): boolean => (
  OWNER_ONLY_ACTION_FIELDS.has(field)
  || RAW_EXECUTION_ACTION_FIELDS.has(field)
  || SYSTEM_INJECTED_ACTION_FIELDS.has(field)
);

export function getAiVisibleActionFields(entry: AtomicMuscleMemoryEntry): Set<string> {
  const visibleFields = new Set(
    [...entry.inputContract.requiredFields, ...entry.inputContract.optionalFields]
      .filter((field) => !isSystemInjectedActionField(field)),
  );
  for (const field of EXTRA_AI_VISIBLE_FIELDS_BY_ACTION_CODE[entry.actionCode] ?? []) {
    visibleFields.add(field);
  }
  return visibleFields;
}