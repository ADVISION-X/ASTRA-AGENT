import { z } from "zod";

import {
  findMuscleMemoryEntry,
  isAiActionPlanAllowedActionCode,
} from "../../muscle-memory/catalog/muscle-memory-catalog.js";
import type { AtomicMuscleMemoryEntry } from "../../muscle-memory/catalog/muscle-memory-catalog.schema.js";
import { MuscleMemoryGridCellSchema, MuscleMemoryPressKeySchema } from "../../muscle-memory/schema.js";
import {
  getAiVisibleActionFields,
  isAiForbiddenActionField,
  isSystemInjectedActionField,
} from "./action-field-policy.js";

const VisualMissionPlatformSchema = z.enum(["facebook-web", "tiktok-web"]);
const VisualMissionActionInputSchema = z.record(z.string().min(1), z.unknown());

function resolveAtomicActionEntry(actionCode: string): AtomicMuscleMemoryEntry | null {
  const entry = findMuscleMemoryEntry(actionCode);
  return entry && entry.type === "atomic" ? entry : null;
}

function validateAtomicActionInput(
  actionCode: string,
  actionInput: Record<string, unknown>,
  entry: AtomicMuscleMemoryEntry,
  context: z.RefinementCtx,
) {
  const visibleFields = getAiVisibleActionFields(entry);

  for (const field of entry.inputContract.requiredFields) {
    if (!isSystemInjectedActionField(field) && !(field in actionInput)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `${actionCode} requires input.${field}.`, path: ["input", field] });
    }
  }

  for (const field of Object.keys(actionInput)) {
    if (entry.inputContract.forbiddenFields.includes(field) || isAiForbiddenActionField(field)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `${actionCode} must not expose input.${field}.`, path: ["input", field] });
      continue;
    }
    if (!visibleFields.has(field)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `${actionCode} does not allow input.${field}.`, path: ["input", field] });
    }
  }

  if ("key" in actionInput && !MuscleMemoryPressKeySchema.safeParse(actionInput.key).success) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: `${actionCode} requires a governed input.key value.`, path: ["input", "key"] });
  }
  if ("gridCell" in actionInput && !MuscleMemoryGridCellSchema.safeParse(actionInput.gridCell).success) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: `${actionCode} requires a governed input.gridCell value.`, path: ["input", "gridCell"] });
  }
}

const validateVisualMissionActionInput = (value: {
  actionCode: string;
  input?: Record<string, unknown> | undefined;
}, context: z.RefinementCtx) => {
  const actionInput = value.input ?? {};
  const entry = findMuscleMemoryEntry(value.actionCode);

  if (!entry || !entry.allowedForAiActionPlan) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "actionCode must be registered in MuscleMemoryCatalog and allowed for AI planning.", path: ["actionCode"] });
    return;
  }

  if (entry.type === "atomic") {
    validateAtomicActionInput(value.actionCode, actionInput, entry, context);
    return;
  }

  for (const field of Object.keys(actionInput)) {
    if (isAiForbiddenActionField(field)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `${value.actionCode} must not expose input.${field}.`, path: ["input", field] });
    }
  }
};

const VisualMissionActionSchema = z.object({
  actionCode: z.string().min(1).refine(isAiActionPlanAllowedActionCode, "actionCode must be registered in MuscleMemoryCatalog and allowed for AI planning."),
  required: z.boolean().default(true),
  input: VisualMissionActionInputSchema.optional(),
  reason: z.string().min(1),
}).strict().superRefine(validateVisualMissionActionInput);

const VisualMissionClickTargetSchema = z.object({
  gridCell: MuscleMemoryGridCellSchema,
  targetName: z.string().min(1),
}).strict();

const VisualMissionPlatformContextSchema = z.object({
  platformId: VisualMissionPlatformSchema,
  targetUrl: z.string().url(),
  targetTitle: z.string().min(1),
}).strict();

const VisualMissionActionPlanRequestInputSchema = z.object({
  userRequirementRef: z.string().min(1),
  userRequirementText: z.string().min(1),
  systemManualRef: z.string().min(1),
  outputSchemaRef: z.literal("ai.visual_mission_action_plan.v1"),
  originalScreenshotRef: z.string().min(1),
  coordinateGridScreenshotRef: z.string().min(1),
  gridSpecRef: z.string().min(1),
  platformContextRef: z.string().min(1),
  platformContext: VisualMissionPlatformContextSchema,
}).strict();

const VisualMissionActionPlanOutputSchema = z.object({
  schemaVersion: z.literal("visualMissionActionPlan.v1"),
  userIntentUnderstanding: z.object({
    matched: z.boolean(),
    summary: z.string().min(1),
  }).strict(),
  platform: VisualMissionPlatformSchema,
  isTargetPlatform: z.boolean(),
  surface: z.string().min(1),
  isTargetFeed: z.boolean(),
  pageStateDecision: z.enum(["ready", "recover", "review_required", "blocked"]),
  isProductVideo: z.boolean(),
  productDecision: z.enum(["product_yes", "product_no", "uncertain"]),
  confidence: z.number().min(0).max(1),
  visibleProductTypes: z.array(z.string().min(1)).default([]),
  visualEvidence: z.array(z.string().min(1)).min(1),
  reason: z.string().min(1),
  actions: z.array(VisualMissionActionSchema).min(1),
  clickTargets: z.array(VisualMissionClickTargetSchema).default([]),
  riskFlags: z.array(z.string().min(1)).default([]),
  nonExecutableSummary: z.string().min(1),
}).strict();

type VisualMissionActionPlanRequestInput = z.infer<typeof VisualMissionActionPlanRequestInputSchema>;
type VisualMissionActionPlanOutput = z.infer<typeof VisualMissionActionPlanOutputSchema>;

export {
  VisualMissionPlatformSchema,
  VisualMissionPlatformContextSchema,
  VisualMissionActionInputSchema,
  VisualMissionActionSchema,
  VisualMissionActionPlanRequestInputSchema,
  VisualMissionActionPlanOutputSchema,
};

export type {
  VisualMissionActionPlanRequestInput,
  VisualMissionActionPlanOutput,
};