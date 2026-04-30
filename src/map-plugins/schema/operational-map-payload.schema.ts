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

export const MapPluginTransitionConditionSchema = z.object({
  source: MapPluginTransitionConditionSourceSchema,
  equals: z.union([z.string(), z.boolean(), z.null()]),
}).strict();