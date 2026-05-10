import { z } from "zod";

import { MUSCLE_MEMORY_ACTION_CODES } from "./action-code.js";

const MUSCLE_MEMORY_PRESS_KEY_ALLOWLIST = ["L", "ArrowDown", "ArrowUp", "Escape", "Enter", "Tab"] as const;
const MuscleMemoryActionCodeSchema = z.enum(MUSCLE_MEMORY_ACTION_CODES);
const MuscleMemoryActionKindSchema = z.enum(["atomic", "recipe"]);
const MuscleMemoryRiskLevelSchema = z.enum(["observe", "evidence_write", "local_action", "external_action", "review_required"]);
const MuscleMemoryGridCellSchema = z.string().regex(/^[A-Z]+[1-9]\d*$/u, "gridCell must use governed cell coordinates like A30 or C50.");
const MuscleMemoryPressKeySchema = z.enum(MUSCLE_MEMORY_PRESS_KEY_ALLOWLIST);

const MuscleMemoryRecipeStepSchema = z.object({
  actionCode: MuscleMemoryActionCodeSchema,
  input: z.record(z.string(), z.unknown()).optional(),
}).strict();

const MuscleMemoryPlatformBindingSchema = z.object({
  abilityGroupId: z.string().min(1),
  childCapabilityId: z.string().min(1),
}).strict();

const validateAtomicBindingPresence = (
  value: { abilityGroupId?: string | undefined; childCapabilityId?: string | undefined; platformBindings?: Record<string, unknown> | undefined },
  context: z.RefinementCtx,
) => {
  const hasDirectBinding = typeof value.abilityGroupId === "string" && typeof value.childCapabilityId === "string";
  const hasPlatformBindings = value.platformBindings && Object.keys(value.platformBindings).length > 0;
  if (!hasDirectBinding && !hasPlatformBindings) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Atomic muscle-memory actions require a direct child binding or platform bindings.",
      path: ["childCapabilityId"],
    });
  }
};

const validateAtomicRecipeExclusion = (value: { steps: unknown[] }, context: z.RefinementCtx) => {
  if (value.steps.length > 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Atomic muscle-memory actions must not contain recipe steps.",
      path: ["steps"],
    });
  }
};

const validateRecipeHasSteps = (value: { steps: unknown[] }, context: z.RefinementCtx) => {
  if (value.steps.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Recipe muscle-memory actions require at least one registered step.",
      path: ["steps"],
    });
  }
};

const validateAtomicActionShape = (
  value: {
    abilityGroupId?: string | undefined;
    childCapabilityId?: string | undefined;
    platformBindings?: Record<string, unknown> | undefined;
    steps: unknown[];
  },
  context: z.RefinementCtx,
) => {
  validateAtomicBindingPresence(value, context);
  validateAtomicRecipeExclusion(value, context);
};

const validateMuscleMemoryActionShape = (
  value: {
    kind: "atomic" | "recipe";
    abilityGroupId?: string | undefined;
    childCapabilityId?: string | undefined;
    platformBindings?: Record<string, unknown> | undefined;
    steps: unknown[];
  },
  context: z.RefinementCtx,
) => {
  if (value.kind === "atomic") {
    validateAtomicActionShape(value, context);
    return;
  }

  validateRecipeHasSteps(value, context);
};

const MuscleMemoryActionSchema = z.object({
  actionCode: MuscleMemoryActionCodeSchema,
  kind: MuscleMemoryActionKindSchema,
  displayName: z.string().min(1),
  description: z.string().min(1),
  abilityGroupId: z.string().min(1).optional(),
  childCapabilityId: z.string().min(1).optional(),
  platformBindings: z.record(z.string(), MuscleMemoryPlatformBindingSchema).optional(),
  inputSchemaRef: z.string().min(1),
  outputRefPolicy: z.array(z.string().min(1)).default([]),
  allowedForAiPlan: z.boolean(),
  modifiesExternalWorld: z.boolean(),
  requiresGridSpec: z.boolean(),
  riskLevel: MuscleMemoryRiskLevelSchema,
  steps: z.array(MuscleMemoryRecipeStepSchema).default([]),
}).strict().superRefine(validateMuscleMemoryActionShape);

export {
  MUSCLE_MEMORY_PRESS_KEY_ALLOWLIST,
  MuscleMemoryActionCodeSchema,
  MuscleMemoryActionKindSchema,
  MuscleMemoryRiskLevelSchema,
  MuscleMemoryGridCellSchema,
  MuscleMemoryPressKeySchema,
  MuscleMemoryRecipeStepSchema,
  MuscleMemoryPlatformBindingSchema,
  MuscleMemoryActionSchema,
};

export type {
  z,
};