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

type MuscleSegmentValue = {
  segmentId: string;
  coreMuscle: z.output<typeof CoreMuscleSchema>;
  displayName: string;
  consumesRefs: string[];
  producesRefs: string[];
  allowedAbilityGroups: string[];
  aiRequired: boolean;
  semanticOwner: "ai" | "none";
  requiresTargetCandidateRef?: boolean | undefined;
  postClickObservation?: boolean | undefined;
  fallbackPolicy?: "forbidden" | "fallback-only-with-post-click-observation" | undefined;
  description: string;
};

const MUSCLE_SEGMENT_TARGET_CANDIDATE_REFS = [
  "nextItemTargetCandidateRef",
  "aiTargetCandidateRef",
  "targetCandidateRef",
  "sourceAiResultRef",
  "sourceVisualTargetResultRef",
] as const;

const addMuscleSegmentIssue = (context: z.RefinementCtx, path: string[], message: string) => {
  context.addIssue({
    code: z.ZodIssueCode.custom,
    path,
    message,
  });
};

const validateMuscleSegmentAllowedAbilityGroups = (value: MuscleSegmentValue, context: z.RefinementCtx) => {
  if (value.allowedAbilityGroups.includes("map-plugin-package")) {
    addMuscleSegmentIssue(context, ["allowedAbilityGroups"], "Muscle segments must not list map-plugin-package as an allowed ability group.");
  }
};

const validateMuscleSegmentSemanticOwner = (value: MuscleSegmentValue, context: z.RefinementCtx) => {
  if (value.aiRequired && value.semanticOwner !== "ai") {
    addMuscleSegmentIssue(context, ["semanticOwner"], "Segments that require semantic judgment must declare semanticOwner=ai.");
  }
};

const validateAdvanceNextItemMuscleSegment = (value: MuscleSegmentValue, context: z.RefinementCtx) => {
  if (value.coreMuscle !== "advance-next-item") {
    return;
  }

  const usesNavigationKey = value.allowedAbilityGroups.includes("text-input");
  if (!usesNavigationKey && value.requiresTargetCandidateRef !== true) {
    addMuscleSegmentIssue(context, ["requiresTargetCandidateRef"], "Advance Next Item segments must require governed target candidate refs.");
  }
  if (usesNavigationKey && value.requiresTargetCandidateRef !== false) {
    addMuscleSegmentIssue(context, ["requiresTargetCandidateRef"], "Advance Next Item segments that use governed navigation-key input must explicitly disable target candidate refs.");
  }
  if (!value.fallbackPolicy) {
    addMuscleSegmentIssue(context, ["fallbackPolicy"], "Advance Next Item segments must declare an explicit fallback policy.");
  }
};

const validateMuscleSegmentFallbackPolicy = (value: MuscleSegmentValue, context: z.RefinementCtx) => {
  if (value.fallbackPolicy === "fallback-only-with-post-click-observation" && value.postClickObservation !== true) {
    addMuscleSegmentIssue(context, ["fallbackPolicy"], "Fallback-only muscle segments must declare postClickObservation as a non-blocking quality signal.");
  }
};

const validateMuscleSegmentTargetCandidates = (value: MuscleSegmentValue, context: z.RefinementCtx) => {
  if (value.requiresTargetCandidateRef === true && !MUSCLE_SEGMENT_TARGET_CANDIDATE_REFS.some((ref) => value.consumesRefs.includes(ref))) {
    addMuscleSegmentIssue(context, ["consumesRefs"], "Segments that require target candidates must consume nextItemTargetCandidateRef, aiTargetCandidateRef, targetCandidateRef, sourceAiResultRef, or sourceVisualTargetResultRef.");
  }
};

const validateMuscleSegment = (value: MuscleSegmentValue, context: z.RefinementCtx) => {
  validateMuscleSegmentAllowedAbilityGroups(value, context);
  validateMuscleSegmentSemanticOwner(value, context);
  validateAdvanceNextItemMuscleSegment(value, context);
  validateMuscleSegmentFallbackPolicy(value, context);
  validateMuscleSegmentTargetCandidates(value, context);
};

export const MuscleSegmentSchema = z.object({
  segmentId: z.string().min(1),
  coreMuscle: CoreMuscleSchema,
  displayName: z.string().min(1),
  consumesRefs: z.array(z.string().min(1)).default([]),
  producesRefs: z.array(z.string().min(1)).default([]),
  allowedAbilityGroups: z.array(z.string().min(1)).default([]),
  aiRequired: z.boolean(),
  semanticOwner: z.enum(["ai", "none"]),
  requiresTargetCandidateRef: z.boolean().optional(),
  postClickObservation: z.boolean().optional(),
  fallbackPolicy: z.enum(["forbidden", "fallback-only-with-post-click-observation"]).optional(),
  description: z.string().min(1),
}).strict().superRefine((value, context) => {
  validateMuscleSegment(value, context);
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
