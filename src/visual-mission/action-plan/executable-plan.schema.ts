import { z } from "zod";

import { VisualMissionPlatformSchema } from "./ai-output.schema.js";

const nullableRef = z.string().min(1).nullable().default(null);
const VisualMissionExecutableActionInputSchema = z.record(z.string().min(1), z.unknown());

const VisualMissionExecutablePlanContextRefsSchema = z.object({
  aiResultRef: nullableRef,
  originalScreenshotRef: nullableRef,
  coordinateGridScreenshotRef: nullableRef,
  gridSpecRef: nullableRef,
  visualMissionInputRef: nullableRef,
  platformContextRef: nullableRef,
}).strict();

const VisualMissionExecutableActionSchema = z.object({
  actionCode: z.string().min(1),
  required: z.boolean(),
  input: VisualMissionExecutableActionInputSchema.optional(),
  reason: z.string().min(1),
}).strict();

const VisualMissionExecutablePlanSchema = z.object({
  schemaVersion: z.literal("visualMissionActionPlan.v1"),
  userRequirementRef: nullableRef,
  muscleMemoryCatalogVersion: z.string().min(1),
  platform: VisualMissionPlatformSchema,
  pageStateDecision: z.enum(["ready", "recover_to_entry", "wait", "stop_review_required"]),
  taskDecision: z.string().min(1),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1),
  actions: z.array(VisualMissionExecutableActionSchema).min(1),
  riskFlags: z.array(z.string().min(1)).default([]),
  nonExecutableSummary: z.string().min(1),
  contextRefs: VisualMissionExecutablePlanContextRefsSchema.default({
    aiResultRef: null,
    originalScreenshotRef: null,
    coordinateGridScreenshotRef: null,
    gridSpecRef: null,
    visualMissionInputRef: null,
    platformContextRef: null,
  }),
}).strict();

type VisualMissionExecutableAction = z.infer<typeof VisualMissionExecutableActionSchema>;
type VisualMissionExecutablePlanContextRefs = z.infer<typeof VisualMissionExecutablePlanContextRefsSchema>;
type VisualMissionExecutablePlan = z.infer<typeof VisualMissionExecutablePlanSchema>;

export {
  VisualMissionExecutableActionInputSchema,
  VisualMissionExecutableActionSchema,
  VisualMissionExecutablePlanContextRefsSchema,
  VisualMissionExecutablePlanSchema,
};

export type {
  VisualMissionExecutableAction,
  VisualMissionExecutablePlan,
  VisualMissionExecutablePlanContextRefs,
};