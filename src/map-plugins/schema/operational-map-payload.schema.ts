import { z } from "zod";

export const MapPluginPayloadRefKeySchema = z.enum([
  "requestedPlatformId",
  "selectedMapId",
  "operatorNote",
  "targetUrl",
  "targetTitle",
  "sourceEvidenceRef",
  "sourceTargetRef",
  "screenshotEvidenceRef",
  "commentsEvidenceRef",
  "visualTargetRef",
  "geometryProofRef",
  "pageStateRef",
  "aiResultRef",
  "abilityResultRef",
  "promptInputRef",
  "commandInputRef",
  "reviewReasonRef",
  "runtimeLogRef",
] as const);

export const MapPluginStepKindSchema = z.enum(["ability", "ai", "review", "finalize"]);
export const MapPluginTransitionStatusSchema = z.enum(["success", "failed", "review_required"]);
export const MapPluginTransitionConditionSourceSchema = z.string().min(1).regex(/^[a-zA-Z][a-zA-Z0-9._-]*$/, {
  message: "leftRef must be a declared field ref, not an executable expression.",
});
export const MapPluginMissionTerminalStatusSchema = z.enum(["completed", "failed", "review_required", "stopped"]);
export const MapPluginTransitionConditionTypeSchema = z.enum(["comparison"]);
export const MapPluginTransitionOperatorSchema = z.enum([
  "equals",
  "notEquals",
  "exists",
  "notExists",
  "greaterThan",
  "lessThan",
  "confidenceAbove",
  "confidenceBelow",
  "statusIs",
  "reviewRequired",
]);

export const MapPluginTransitionConditionSchema = z.object({
  conditionType: MapPluginTransitionConditionTypeSchema,
  leftRef: MapPluginTransitionConditionSourceSchema,
  operator: MapPluginTransitionOperatorSchema,
  rightValue: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  onTrue: z.string().min(1).nullable().optional().default(null),
  onFalse: z.string().min(1).nullable().optional().default(null),
}).strict().superRefine((condition, context) => {
  if (
    ["greaterThan", "lessThan", "confidenceAbove", "confidenceBelow"].includes(condition.operator)
    && typeof condition.rightValue !== "number"
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["rightValue"],
      message: `Operator ${condition.operator} requires numeric rightValue.`,
    });
  }

  if (
    (condition.operator === "statusIs" || condition.operator === "reviewRequired")
    && condition.leftRef !== "status"
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["leftRef"],
      message: `Operator ${condition.operator} requires leftRef=status.`,
    });
  }

  if (
    ["exists", "notExists", "reviewRequired"].includes(condition.operator)
    && condition.rightValue !== null
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["rightValue"],
      message: `Operator ${condition.operator} requires rightValue=null.`,
    });
  }
});