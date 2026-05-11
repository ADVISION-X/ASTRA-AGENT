/**
 * MuscleMemory Capability Registry — catalog + schema only.
 *
 * Governance:
 *   - This module is the sole source of truth for registered atomic abilities.
 *   - It does not execute, decode, compile, or dispatch.
 *   - Every registered ability maps to exactly one abilityGroupId + childCapabilityId.
 *   - The field named `actionCode` serves as the ability's unique registry ID (abilityId).
 *     Short-term backward compatibility: AI schema serializes it as `actionCode`.
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
  actionCode: z.string().min(1),          // serves as abilityId; AI schema uses this name
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

/** Backward-compatible type aliases used by callers that reference old names. */
type AtomicMuscleMemoryEntry = RegisteredAtomicAbility;
type MuscleMemoryEntry = RegisteredAtomicAbility;
type MuscleMemoryCatalog = CapabilityRegistryCatalog;

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

export function listRegisteredAbilities(): RegisteredAtomicAbility[] {
  return loadMuscleMemoryCatalog().entries;
}

export function listAiVisibleAbilities(): RegisteredAtomicAbility[] {
  return loadMuscleMemoryCatalog().entries.filter((e) => e.allowedForAiActionPlan);
}

export function getRegisteredAbilityById(actionCode: string): RegisteredAtomicAbility | null {
  return loadMuscleMemoryCatalog().entries.find((e) => e.actionCode === actionCode) ?? null;
}

export function assertRegisteredAbility(actionCode: string): RegisteredAtomicAbility {
  const entry = getRegisteredAbilityById(actionCode);
  if (!entry) {
    throw new Error(`actionCode "${actionCode}" is not registered in the MuscleMemory capability registry.`);
  }
  return entry;
}

// ─── Backward-compatible API (callers that use old names) ─────────────────

/** @deprecated Use getRegisteredAbilityById */
export function findMuscleMemoryEntry(actionCode: string): MuscleMemoryEntry | null {
  return getRegisteredAbilityById(actionCode);
}

/** @deprecated Use listAiVisibleAbilities */
export function listAiActionPlanEntries(): MuscleMemoryEntry[] {
  return listAiVisibleAbilities();
}

export function isAiActionPlanAllowedActionCode(actionCode: unknown): actionCode is string {
  return typeof actionCode === "string"
    && getRegisteredAbilityById(actionCode)?.allowedForAiActionPlan === true;
}

// ─── Exports ───────────────────────────────────────────────────────────────

export {
  FailurePolicySchema,
  CapabilityRegistryInputContractSchema,
  RegisteredAtomicAbilitySchema,
  CapabilityRegistryCatalogSchema,
  // Backward-compatible schema aliases
  RegisteredAtomicAbilitySchema as AtomicMuscleMemoryEntrySchema,
  RegisteredAtomicAbilitySchema as MuscleMemoryEntrySchema,
  CapabilityRegistryCatalogSchema as MuscleMemoryCatalogSchema,
};

export type {
  FailurePolicy,
  CapabilityRegistryInputContract,
  RegisteredAtomicAbility,
  CapabilityRegistryCatalog,
  // Backward-compatible type aliases
  AtomicMuscleMemoryEntry,
  MuscleMemoryEntry,
  MuscleMemoryCatalog,
};
