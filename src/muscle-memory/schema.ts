import { z } from "zod";

const MUSCLE_MEMORY_PRESS_KEY_ALLOWLIST = ["L", "ArrowDown", "ArrowUp", "Escape", "Enter", "Tab"] as const;
const MuscleMemoryGridCellSchema = z.string().regex(/^[A-Z]+[1-9]\d*$/u, "gridCell must use governed cell coordinates like A30 or C50.");
const MuscleMemoryPressKeySchema = z.enum(MUSCLE_MEMORY_PRESS_KEY_ALLOWLIST);
const MuscleMemoryRiskLevelSchema = z.enum(["observe", "local_action", "external_action", "evidence_write", "review_required"]);
const MuscleMemoryOutputRefPolicySchema = z.array(z.string().min(1)).default([]);
const MuscleMemoryPlatformBindingSchema = z.object({
  abilityGroupId: z.string().min(1),
  childCapabilityId: z.string().min(1),
}).strict();
const AtomicMuscleMemoryActionSchema = z.object({
  actionCode: z.string().min(1),
  kind: z.literal("atomic"),
  displayName: z.string().min(1),
  description: z.string().min(1),
  abilityGroupId: z.string().min(1),
  childCapabilityId: z.string().min(1),
  platformBindings: z.record(MuscleMemoryPlatformBindingSchema).optional(),
  inputSchemaRef: z.string().min(1),
  outputRefPolicy: MuscleMemoryOutputRefPolicySchema,
  allowedForAiPlan: z.boolean(),
  modifiesExternalWorld: z.boolean(),
  requiresGridSpec: z.boolean(),
  riskLevel: MuscleMemoryRiskLevelSchema,
}).strict();
const MuscleMemoryActionSchema = AtomicMuscleMemoryActionSchema;

export {
  MUSCLE_MEMORY_PRESS_KEY_ALLOWLIST,
  MuscleMemoryActionSchema,
  MuscleMemoryOutputRefPolicySchema,
  MuscleMemoryPlatformBindingSchema,
  MuscleMemoryRiskLevelSchema,
  MuscleMemoryGridCellSchema,
  MuscleMemoryPressKeySchema,
};
