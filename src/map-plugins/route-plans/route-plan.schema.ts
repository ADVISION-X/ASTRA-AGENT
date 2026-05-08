import { z } from "zod";

import { MapPluginOperationalMapStepSchema } from "../schema/operational-map-step.schema.js";
import { MapPluginTransitionSchema } from "../schema/operational-map-transition.schema.js";

export const RoutePlanOutcomeOptionSchema = z.object({
  optionId: z.string().min(1),
  label: z.string().min(1),
  decision: z.enum(["product_yes", "product_no"]),
  routeLabel: z.string().min(1),
  description: z.string().min(1),
}).strict();

export const CoreMuscleSchema = z.enum([
  "visible-state",
  "target-action",
  "evidence-analysis",
  "advance-next-item",
]);

export const MuscleSegmentSchema = z.object({
  segmentId: z.string().min(1),
  coreMuscle: CoreMuscleSchema,
  displayName: z.string().min(1),
  consumesRefs: z.array(z.string().min(1)).default([]),
  producesRefs: z.array(z.string().min(1)).default([]),
  allowedAbilityGroups: z.array(z.string().min(1)).default([]),
  aiRequired: z.boolean(),
  semanticOwner: z.enum(["ai", "none"]),
  description: z.string().min(1),
}).strict().superRefine((value, context) => {
  if (value.allowedAbilityGroups.includes("map-plugin-package")) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["allowedAbilityGroups"],
      message: "Muscle segments must not list map-plugin-package as an allowed ability group.",
    });
  }
  if (!value.aiRequired && value.producesRefs.some((ref) => ref.toLowerCase().includes("routelabel"))) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["producesRefs"],
      message: "Segments that do not require AI must not produce routeLabel refs.",
    });
  }
  if (value.aiRequired && value.semanticOwner !== "ai") {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["semanticOwner"],
      message: "Segments that require semantic judgment must declare semanticOwner=ai.",
    });
  }
});

export const RoutePlanSchema = z.object({
  routePlanId: z.string().min(1),
  routePlanVersion: z.string().min(1),
  routePlanKind: z.literal("muscle-memory"),
  muscleModelVersion: z.string().min(1).optional(),
  displayName: z.string().min(1),
  supportedSurfaceKinds: z.array(z.string().min(1)).optional(),
  surfaceAgnostic: z.boolean().optional(),
  forbiddenResponsibilities: z.array(z.string().min(1)).optional(),
  muscleSegments: z.array(MuscleSegmentSchema).optional(),
  promptContractIds: z.array(z.string().min(1)).min(1),
  outcomeOptions: z.array(RoutePlanOutcomeOptionSchema).min(1),
  selectedPositiveRouteLabel: z.string().min(1),
  selectedNegativeRouteLabel: z.string().min(1),
  steps: z.array(MapPluginOperationalMapStepSchema).min(1),
  transitions: z.array(MapPluginTransitionSchema).min(1),
}).strict().superRefine((value, context) => {
  const routeLabels = new Set(value.outcomeOptions.map((option) => option.routeLabel));
  if (!routeLabels.has(value.selectedPositiveRouteLabel)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["selectedPositiveRouteLabel"],
      message: "selectedPositiveRouteLabel must exist in outcomeOptions.",
    });
  }
  if (!routeLabels.has(value.selectedNegativeRouteLabel)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["selectedNegativeRouteLabel"],
      message: "selectedNegativeRouteLabel must exist in outcomeOptions.",
    });
  }
});

export type RoutePlan = z.output<typeof RoutePlanSchema>;
export type RoutePlanOutcomeOption = z.output<typeof RoutePlanOutcomeOptionSchema>;
export type CoreMuscle = z.output<typeof CoreMuscleSchema>;
export type MuscleSegment = z.output<typeof MuscleSegmentSchema>;
