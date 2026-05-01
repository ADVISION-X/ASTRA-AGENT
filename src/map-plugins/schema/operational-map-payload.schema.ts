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
export const MapPluginTransitionConditionSourceSchema = z.enum(["status", "decision"]);
export const MapPluginMissionTerminalStatusSchema = z.enum(["completed", "failed", "review_required", "stopped"]);
export const MapPluginTransitionConditionTypeSchema = z.enum(["comparison"]);
export const MapPluginTransitionOperatorSchema = z.enum(["equals"]);

export const MapPluginTransitionConditionSchema = z.object({
  conditionType: MapPluginTransitionConditionTypeSchema.optional().default("comparison"),
  leftRef: MapPluginPayloadRefKeySchema.nullable().optional().default(null),
  operator: MapPluginTransitionOperatorSchema.optional().default("equals"),
  rightValue: z.union([z.string(), z.boolean(), z.null()]).optional().default(null),
  onTrue: z.string().min(1).nullable().optional().default(null),
  onFalse: z.string().min(1).nullable().optional().default(null),
  source: MapPluginTransitionConditionSourceSchema,
  equals: z.union([z.string(), z.boolean(), z.null()]),
}).strict();