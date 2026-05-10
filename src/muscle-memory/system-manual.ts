import { createHash } from "node:crypto";

import { MUSCLE_MEMORY_CATALOG_VERSION, listAiPlanEligibleActions } from "./catalog.js";

function buildActionBlock(action: ReturnType<typeof listAiPlanEligibleActions>[number]): string {
  const binding = action.platformBindings
    ? `platformBindings:\n${Object.entries(action.platformBindings).map(([platformId, value]) => `  ${platformId}: ${value.abilityGroupId}/${value.childCapabilityId}`).join("\n")}`
    : `abilityGroupId: ${action.abilityGroupId}\nchildCapabilityId: ${action.childCapabilityId}`;
  const steps = action.kind === "recipe"
    ? `\nsteps:\n${action.steps.map((step) => `  - actionCode: ${step.actionCode}${step.input ? `\n    input: ${JSON.stringify(step.input)}` : ""}`).join("\n")}`
    : "";
  return [
    `actionCode: ${action.actionCode}`,
    `kind: ${action.kind}`,
    binding,
    `displayName: ${action.displayName}`,
    `description: ${action.description}`,
    `inputSchemaRef: ${action.inputSchemaRef}`,
    `allowedForAiPlan: ${String(action.allowedForAiPlan)}`,
    `modifiesExternalWorld: ${String(action.modifiesExternalWorld)}`,
    `requiresGridSpec: ${String(action.requiresGridSpec)}`,
    `riskLevel: ${action.riskLevel}`,
    steps,
  ].filter(Boolean).join("\n");
}

function buildSystemManualText(): string {
  return listAiPlanEligibleActions().map((action) => buildActionBlock(action)).join("\n\n");
}

function buildSystemManualRef(text: string): string {
  return `system-manual:${createHash("sha256").update(text).digest("hex").slice(0, 16)}`;
}

function buildMuscleMemorySystemManual() {
  const text = buildSystemManualText();
  return {
    systemManualRef: buildSystemManualRef(text),
    catalogVersion: MUSCLE_MEMORY_CATALOG_VERSION,
    text,
    actions: listAiPlanEligibleActions(),
  };
}

export { buildMuscleMemorySystemManual };