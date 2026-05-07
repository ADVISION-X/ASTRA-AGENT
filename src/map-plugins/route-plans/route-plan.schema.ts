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

export const RoutePlanSchema = z.object({
  routePlanId: z.string().min(1),
  routePlanVersion: z.string().min(1),
  routePlanKind: z.literal("muscle-memory"),
  displayName: z.string().min(1),
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
