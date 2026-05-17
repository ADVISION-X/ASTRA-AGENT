import { z } from "zod";

import {
  getRegisteredAbilityById,
  isAiActionPlanAllowedActionCode,
} from "../../muscle-memory/catalog.js";
import type { RegisteredAtomicAbility } from "../../muscle-memory/catalog.js";
import {
  MuscleMemoryCellZoneSchema,
  MuscleMemoryGridCellSchema,
  MuscleMemoryPressKeySchema,
} from "../../muscle-memory/schema.js";
import { VISUAL_MISSION_PLATFORM_IDS } from "../platform-target-registry.js";
import {
  getAiRequiredActionFields,
  getAiVisibleActionFields,
  isAiForbiddenActionField,
} from "../action-plan/action-field-policy.js";

const VisualMissionPlatformSchema = z.enum(VISUAL_MISSION_PLATFORM_IDS);
const PureVisualRoundActionInputSchema = z.record(z.string().min(1), z.unknown());
const PureVisualRoundDecisionSchema = z.enum(["act", "done", "review_required", "blocked"]);

function isGridCellInputField(field: string): boolean {
  return field === "gridCell" || field.endsWith("GridCell");
}

function validateRequiredFields(
  actionCode: string,
  actionInput: Record<string, unknown>,
  entry: RegisteredAtomicAbility,
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
  entry: RegisteredAtomicAbility,
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
      continue;
    }
    if (field === "cellZone" && !MuscleMemoryCellZoneSchema.safeParse(value).success) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `${actionCode} requires a governed input.cellZone value.`, path: ["input", field] });
    }
  }
}

function validateNextActionInput(
  value: {
    actionCode: string;
    input?: Record<string, unknown> | undefined;
    gridCell?: string | null | undefined;
    cellZone?: string | null | undefined;
  },
  context: z.RefinementCtx,
) {
  const actionInput = {
    ...(value.input ?? {}),
    ...(value.gridCell ? { gridCell: value.gridCell } : {}),
    ...(value.cellZone ? { cellZone: value.cellZone } : {}),
  };
  const entry = getRegisteredAbilityById(value.actionCode);

  if (!entry || !entry.allowedForAiActionPlan) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "actionCode must be registered in MuscleMemoryCatalog and allowed for AI planning.", path: ["actionCode"] });
    return;
  }

  validateRequiredFields(value.actionCode, actionInput, entry, context);
  validateProvidedFields(value.actionCode, actionInput, entry, context);
  validateGovernedValues(value.actionCode, actionInput, context);
}

const PureVisualRoundNextActionSchema = z.object({
  actionCode: z.string().min(1).transform((v) => v.toUpperCase()).refine(isAiActionPlanAllowedActionCode, "actionCode must be registered in MuscleMemoryCatalog and allowed for AI planning."),
  reason: z.string().min(1),
  input: PureVisualRoundActionInputSchema.optional().default({}),
  gridCell: MuscleMemoryGridCellSchema.nullable().optional().default(null),
  cellZone: MuscleMemoryCellZoneSchema.nullable().optional().default(null),
}).strict().superRefine(validateNextActionInput);

const VisualMissionPlatformContextSchema = z.object({
  platformId: VisualMissionPlatformSchema,
  targetUrl: z.string().min(1).nullable().default(null),
  targetTitle: z.string().min(1).nullable().default(null),
  targetProfileRef: z.string().min(1).nullable().default(null),
}).strict();

const VisualMissionActionPlanRequestInputSchema = z.object({
  userRequirementRef: z.string().min(1).nullable().optional().default(null),
  userRequirementText: z.string().min(1),
  systemManualRef: z.string().min(1),
  outputSchemaRef: z.literal("ai.visual_mission_judgment.v1"),
  originalScreenshotRef: z.string().min(1),
  coordinateGridScreenshotRef: z.string().min(1),
  gridSpecRef: z.string().min(1),
  platformContextRef: z.string().min(1),
  platformContext: VisualMissionPlatformContextSchema,
}).strict();

const VisualMissionActionPlanOutputSchema = z.object({
  schemaVersion: z.literal("pureVisualRound.v1"),
  goalMatched: z.boolean(),
  save: z.boolean(),
  saveReason: z.string().min(1),
  confidence: z.number().min(0).max(1),
  visualEvidence: z.array(z.string().min(1)).min(1),
  decision: PureVisualRoundDecisionSchema,
  nextAction: PureVisualRoundNextActionSchema.nullable(),
  reviewRequiredReason: z.string().min(1).nullable().default(null),
  doneReason: z.string().min(1).nullable().default(null),
}).strict().superRefine((output, context) => {
  if (output.goalMatched && !output.save && output.decision !== "blocked" && output.decision !== "review_required") {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "save must be true when goalMatched is true.", path: ["save"] });
  }
  if (output.decision === "act" && output.nextAction === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "nextAction is required when decision is act.", path: ["nextAction"] });
  }
  if (output.decision !== "act" && output.nextAction !== null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "nextAction must be null unless decision is act.", path: ["nextAction"] });
  }
  if (output.decision === "review_required" && !output.reviewRequiredReason) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "reviewRequiredReason is required when decision is review_required.", path: ["reviewRequiredReason"] });
  }
  if (output.decision === "done" && !output.doneReason) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "doneReason is required when decision is done.", path: ["doneReason"] });
  }
});

type VisualMissionActionPlanRequestInput = z.infer<typeof VisualMissionActionPlanRequestInputSchema>;
type VisualMissionActionPlanOutput = z.infer<typeof VisualMissionActionPlanOutputSchema>;
type PureVisualRoundNextAction = z.infer<typeof PureVisualRoundNextActionSchema>;

export {
  VisualMissionPlatformSchema,
  VisualMissionPlatformContextSchema,
  PureVisualRoundActionInputSchema as VisualMissionActionInputSchema,
  PureVisualRoundNextActionSchema,
  VisualMissionActionPlanRequestInputSchema,
  VisualMissionActionPlanOutputSchema,
};

export type {
  PureVisualRoundNextAction,
  VisualMissionActionPlanRequestInput,
  VisualMissionActionPlanOutput,
};
