import { z } from "zod";

const VisualMissionPlatformSchema = z.enum(["facebook-web", "tiktok-web", "macos-local", "unknown"]);
const VisualMissionPageStateDecisionSchema = z.enum(["ready", "recover_to_entry", "wait", "stop_review_required"]);

const VisualMissionActionInputSchema = z.record(z.unknown());

const VisualMissionActionSchema = z.object({
  actionCode: z.string().min(1),
  required: z.boolean(),
  input: VisualMissionActionInputSchema.optional(),
  reason: z.string().min(1),
}).strict();

const VisualMissionActionPlanSchema = z.object({
  schemaVersion: z.literal("visualMissionActionPlan.v1"),
  userRequirementRef: z.string().min(1).nullable().default(null),
  muscleMemoryCatalogVersion: z.string().min(1),
  platform: VisualMissionPlatformSchema,
  pageStateDecision: VisualMissionPageStateDecisionSchema,
  taskDecision: z.string().min(1),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1),
  actions: z.array(VisualMissionActionSchema).min(1),
  riskFlags: z.array(z.string().min(1)).default([]),
  nonExecutableSummary: z.string().min(1),
}).strict();

type VisualMissionAction = z.infer<typeof VisualMissionActionSchema>;
type VisualMissionActionPlan = z.infer<typeof VisualMissionActionPlanSchema>;

export {
  VisualMissionPlatformSchema,
  VisualMissionPageStateDecisionSchema,
  VisualMissionActionInputSchema,
  VisualMissionActionSchema,
  VisualMissionActionPlanSchema,
};

export type { VisualMissionAction, VisualMissionActionPlan };