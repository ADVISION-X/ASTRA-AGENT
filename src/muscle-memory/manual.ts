/**
 * MuscleMemory System Manual — builds AI-readable ability handbook.
 *
 * Governance:
 *   - Only formats allowedForAiActionPlan=true atomic registered abilities.
 *   - Does not decide business actions, filter flows, or construct execution plans.
 *   - Output is consumed by AI prompt builders.
 */

import { createHash } from "node:crypto";

import { listAiVisibleAbilities, loadMuscleMemoryCatalog } from "./catalog.js";
import type { RegisteredAtomicAbility } from "./catalog.js";
import { resolveAiActionInputPolicy } from "../visual-mission/action-plan/action-field-policy.js";

function formatFieldList(fields: string[]): string {
  return fields.length > 0 ? fields.join(", ") : "(none)";
}

function buildAbilityBlock(ability: RegisteredAtomicAbility): string {
  const inputPolicy = resolveAiActionInputPolicy(ability);
  return [
    `actionCode: ${ability.actionCode}`,
    "type: atomic",
    `binding: ${ability.abilityGroupId}/${ability.childCapabilityId}`,
    `displayName: ${ability.displayName}`,
    `description: ${ability.description}`,
    `inputSchemaRef: ${ability.inputSchemaRef}`,
    `outputSchemaRef: ${ability.outputSchemaRef}`,
    `aiRequiredInput: ${formatFieldList(inputPolicy.aiRequiredInput)}`,
    `aiOptionalInput: ${formatFieldList(inputPolicy.aiOptionalInput)}`,
    `systemInjectedInput: ${formatFieldList(inputPolicy.systemInjectedInput)}`,
    `forbiddenInput: ${formatFieldList(inputPolicy.forbiddenInput)}`,
    `failurePolicy: ${ability.failurePolicy}`,
  ].join("\n");
}

function buildManualText(): string {
  return listAiVisibleAbilities().map((a) => buildAbilityBlock(a)).join("\n\n");
}

function buildManualRef(text: string): string {
  return `system-manual:${createHash("sha256").update(text).digest("hex").slice(0, 16)}`;
}

export function buildMuscleMemorySystemManual() {
  const text = buildManualText();
  return {
    systemManualRef: buildManualRef(text),
    catalogVersion: loadMuscleMemoryCatalog().catalogVersion,
    text,
    actions: listAiVisibleAbilities(),
  };
}
