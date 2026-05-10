import { createHash } from "node:crypto";

import {
  listAiActionPlanEntries,
  loadMuscleMemoryCatalog,
} from "./catalog/muscle-memory-catalog.js";
import type { MuscleMemoryEntry } from "./catalog/muscle-memory-catalog.schema.js";

function formatFieldList(fields: string[]): string {
  return fields.length > 0 ? fields.join(", ") : "(none)";
}

function buildActionBlock(action: MuscleMemoryEntry): string {
  if (action.type === "atomic") {
    return [
      `actionCode: ${action.actionCode}`,
      "type: atomic",
      `binding: ${action.abilityGroupId}/${action.childCapabilityId}`,
      `displayName: ${action.displayName}`,
      `description: ${action.description}`,
      `inputSchemaRef: ${action.inputSchemaRef}`,
      `outputSchemaRef: ${action.outputSchemaRef}`,
      `requiredInput: ${formatFieldList(action.inputContract.requiredFields)}`,
      `optionalInput: ${formatFieldList(action.inputContract.optionalFields)}`,
      `forbiddenInput: ${formatFieldList(action.inputContract.forbiddenFields)}`,
      `failurePolicy: ${action.failurePolicy}`,
    ].join("\n");
  }

  return [
    `actionCode: ${action.actionCode}`,
    "type: composite",
    `displayName: ${action.displayName}`,
    `description: ${action.description}`,
    `failurePolicy: ${action.failurePolicy}`,
    `maxExpansionDepth: ${String(action.maxExpansionDepth)}`,
    "steps:",
    ...action.steps.map((step) => `  - ${step.stepCode}: ${step.actionCode} [required=${String(step.required)} onFailure=${step.onFailure}]`),
  ].join("\n");
}

function buildSystemManualText(): string {
  return listAiActionPlanEntries().map((action) => buildActionBlock(action)).join("\n\n");
}

function buildSystemManualRef(text: string): string {
  return `system-manual:${createHash("sha256").update(text).digest("hex").slice(0, 16)}`;
}

function buildMuscleMemorySystemManual() {
  const text = buildSystemManualText();
  return {
    systemManualRef: buildSystemManualRef(text),
    catalogVersion: loadMuscleMemoryCatalog().catalogVersion,
    text,
    actions: listAiActionPlanEntries(),
  };
}

export { buildMuscleMemorySystemManual };