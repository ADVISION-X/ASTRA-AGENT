/**
 * MuscleMemory Capability Registry — catalog + schema only.
 *
 * Governance:
 *   - This module is the sole source of truth for registered atomic abilities.
 *   - It does not execute, decode, compile, or dispatch.
 *   - Every registered ability maps to exactly one abilityGroupId + childCapabilityId.
 *   - The field named `actionCode` is the ability registry ID used by AI plans.
 */

import { readFileSync } from "node:fs";
import { z } from "zod";

// ─── Schema ────────────────────────────────────────────────────────────────

const FailurePolicySchema = z.enum(["continue", "stop", "review_required"]);

const CapabilityRegistryInputContractSchema = z.object({
  requiredFields: z.array(z.string().min(1)).default([]),
  optionalFields: z.array(z.string().min(1)).default([]),
  forbiddenFields: z.array(z.string().min(1)).default([]),
}).strict();

/**
 * RegisteredAtomicAbilitySchema — the canonical entry in the capability registry.
 *
 * Field `actionCode` is the unique ability registry ID (abilityId).
 * No executor, decoder, composite, recipe, workflow, or runtime fields.
 */
const RegisteredAtomicAbilitySchema = z.object({
  actionCode: z.string().min(1),
  type: z.literal("atomic"),
  displayName: z.string().min(1),
  description: z.string().min(1),
  abilityGroupId: z.string().min(1),
  childCapabilityId: z.string().min(1),
  inputSchemaRef: z.string().min(1),
  outputSchemaRef: z.string().min(1),
  allowedForAiActionPlan: z.boolean(),
  allowedForUserRequirement: z.boolean(),
  requiresGridSpecRef: z.boolean(),
  requiresScreenshotRef: z.boolean(),
  requiresGeometryProof: z.boolean(),
  sensitiveOperation: z.boolean(),
  inputContract: CapabilityRegistryInputContractSchema,
  successOutputRefs: z.array(z.string().min(1)).default([]),
  failurePolicy: FailurePolicySchema,
  forbiddenResponsibilities: z.array(z.string().min(1)).default([]),
}).strict();

const CapabilityRegistryCatalogSchema = z.object({
  catalogId: z.literal("grasseye-muscle-memory-catalog"),
  catalogVersion: z.string().min(1),
  generatedAt: z.string().datetime(),
  entries: z.array(RegisteredAtomicAbilitySchema).min(1),
}).strict();

// ─── Types ─────────────────────────────────────────────────────────────────

type FailurePolicy = z.infer<typeof FailurePolicySchema>;
type CapabilityRegistryInputContract = z.infer<typeof CapabilityRegistryInputContractSchema>;
type RegisteredAtomicAbility = z.infer<typeof RegisteredAtomicAbilitySchema>;
type CapabilityRegistryCatalog = z.infer<typeof CapabilityRegistryCatalogSchema>;

// ─── Catalog loader ────────────────────────────────────────────────────────

const GENERATED_CATALOG_PATH = new URL("./generated-catalog.json", import.meta.url);

let catalogCache: CapabilityRegistryCatalog | null = null;

function readCatalog(): CapabilityRegistryCatalog {
  const raw = JSON.parse(readFileSync(GENERATED_CATALOG_PATH, "utf8"));
  return CapabilityRegistryCatalogSchema.parse(raw);
}

export function loadMuscleMemoryCatalog(): CapabilityRegistryCatalog {
  catalogCache ??= readCatalog();
  return catalogCache;
}

export function listAiVisibleAbilities(): RegisteredAtomicAbility[] {
  return loadMuscleMemoryCatalog().entries.filter((e) => e.allowedForAiActionPlan);
}

export function getRegisteredAbilityById(actionCode: string): RegisteredAtomicAbility | null {
  return loadMuscleMemoryCatalog().entries.find((e) => e.actionCode === actionCode) ?? null;
}

export function isAiActionPlanAllowedActionCode(actionCode: unknown): actionCode is string {
  return typeof actionCode === "string"
    && getRegisteredAbilityById(actionCode)?.allowedForAiActionPlan === true;
}


export type {
  RegisteredAtomicAbility,
};
