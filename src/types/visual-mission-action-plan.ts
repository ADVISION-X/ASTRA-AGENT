import { z } from "zod";

import { isAiPlanEligibleActionCode } from "../muscle-memory/catalog.js";
import { MuscleMemoryGridCellSchema, MuscleMemoryPressKeySchema } from "../muscle-memory/schema.js";

const VisualMissionPlatformSchema = z.enum(["facebook-web", "tiktok-web"]);
const VisualMissionActionInputSchema = z.object({
  key: MuscleMemoryPressKeySchema.optional(),
  gridCell: MuscleMemoryGridCellSchema.optional(),
  targetName: z.string().min(1).optional(),
}).strict();

const VisualMissionActionSchema = z.object({
  actionCode: z.string().min(1).refine(isAiPlanEligibleActionCode, "actionCode must be registered in MuscleMemoryCatalog and allowed for AI planning."),
  required: z.boolean().default(true),
  input: VisualMissionActionInputSchema.optional(),
  reason: z.string().min(1),
}).strict().superRefine((value, context) => {
  const input = value.input ?? null;
  if (value.actionCode === "PRESS_KEY" && (!input || !input.key)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "PRESS_KEY requires input.key from the governed key allowlist.", path: ["input", "key"] });
  }
  if (value.actionCode === "CLICK_CELL" && (!input || !input.gridCell)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "CLICK_CELL requires input.gridCell in governed cell format.", path: ["input", "gridCell"] });
  }
  if (value.actionCode !== "PRESS_KEY" && input?.key) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Only PRESS_KEY may carry input.key.", path: ["input", "key"] });
  }
  if (value.actionCode !== "CLICK_CELL" && input?.gridCell) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Only CLICK_CELL may carry input.gridCell.", path: ["input", "gridCell"] });
  }
});

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
}).strict().superRefine((value, context) => {
  for (const action of value.actions) {
    if ((action.input as Record<string, unknown> | undefined)?.x !== undefined || (action.input as Record<string, unknown> | undefined)?.y !== undefined) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Visual mission actions must never expose raw x/y coordinates.", path: ["actions"] });
      break;
    }
  }
});

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