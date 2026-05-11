import { z } from "zod";

import {
  findMuscleMemoryEntry,
  isAiActionPlanAllowedActionCode,
} from "../../muscle-memory/catalog.js";
import type { MuscleMemoryEntry } from "../../muscle-memory/catalog.js";
import { MuscleMemoryGridCellSchema, MuscleMemoryPressKeySchema } from "../../muscle-memory/schema.js";
import { VISUAL_MISSION_PLATFORM_IDS } from "../platform-target-registry.js";
import { RoundMissionPacketSchema } from "../round-mission-packet.schema.js";
import {
  getAiRequiredActionFields,
  getAiVisibleActionFields,
  isAiForbiddenActionField,
} from "./action-field-policy.js";

const VisualMissionPlatformSchema = z.enum(VISUAL_MISSION_PLATFORM_IDS);
const VisualMissionActionInputSchema = z.record(z.string().min(1), z.unknown());

function isGridCellInputField(field: string): boolean {
  return field === "gridCell" || field.endsWith("GridCell");
}

function validateRequiredFields(
  actionCode: string,
  actionInput: Record<string, unknown>,
  entry: MuscleMemoryEntry,
  context: z.RefinementCtx,
) {
  for (const field of getAiRequiredActionFields(entry)) {
    if (!(field in actionInput)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `${actionCode} requires input.${field}.`, path: ["input", field] });
    }
  }
}

function validateProvidedFields(
  actionCode: string,
  actionInput: Record<string, unknown>,
  entry: MuscleMemoryEntry,
  context: z.RefinementCtx,
) {
  const visibleFields = getAiVisibleActionFields(entry);
  for (const field of Object.keys(actionInput)) {
    if (entry.inputContract.forbiddenFields.includes(field) || isAiForbiddenActionField(field)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `${actionCode} must not expose input.${field}.`, path: ["input", field] });
      continue;
    }
    if (!visibleFields.has(field)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `${actionCode} does not allow input.${field}.`, path: ["input", field] });
    }
  }
}

function validateGovernedValues(actionCode: string, actionInput: Record<string, unknown>, context: z.RefinementCtx) {
  for (const [field, value] of Object.entries(actionInput)) {
    if (field === "key" && !MuscleMemoryPressKeySchema.safeParse(value).success) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `${actionCode} requires a governed input.key value.`, path: ["input", field] });
      continue;
    }
    if (isGridCellInputField(field) && !MuscleMemoryGridCellSchema.safeParse(value).success) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `${actionCode} requires a governed input.${field} value.`, path: ["input", field] });
    }
  }
}

function validateActionInput(
  actionCode: string,
  actionInput: Record<string, unknown>,
  entry: MuscleMemoryEntry,
  context: z.RefinementCtx,
) {
  validateRequiredFields(actionCode, actionInput, entry, context);
  validateProvidedFields(actionCode, actionInput, entry, context);
  validateGovernedValues(actionCode, actionInput, context);
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

  validateActionInput(value.actionCode, actionInput, entry, context);
};

const VisualMissionActionSchema = z.object({
  actionCode: z.string().min(1).refine(isAiActionPlanAllowedActionCode, "actionCode must be registered in MuscleMemoryCatalog and allowed for AI planning."),
  required: z.boolean().default(true),
  input: VisualMissionActionInputSchema.optional(),
  reason: z.string().min(1),
}).strict().superRefine(validateVisualMissionActionInput);

const VisualMissionVisualClickTargetHintSchema = z.object({
  gridCell: MuscleMemoryGridCellSchema,
  targetName: z.string().min(1),
}).strict();

const VisualMissionPlatformContextSchema = z.object({
  platformId: VisualMissionPlatformSchema,
  targetUrl: z.string().min(1).nullable().default(null),
  targetTitle: z.string().min(1).nullable().default(null),
  targetProfileRef: z.string().min(1).nullable().default(null),
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
  roundMissionPacketRef: z.string().min(1),
  roundMissionPacket: RoundMissionPacketSchema,
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
  nonExecutableClickTargets: z.array(VisualMissionVisualClickTargetHintSchema).default([]),
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