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
  "screenshotEvidenceRefFrame3s",
  "screenshotEvidenceRefFrame6s",
  "commentsEvidenceRef",
  "visualTargetRef",
  "geometryProofRef",
  "pageStateRef",
  "aiResultRef",
  "abilityResultRef",
  "promptInputRef",
  "promptInputRefFrame3s",
  "promptInputRefFrame6s",
  "commandInputRef",
  "reviewReasonRef",
  "runtimeLogRef",
] as const);

export const MapPluginStepKindSchema = z.enum(["ability", "ai", "finalize"]);
export const MapPluginTransitionStatusSchema = z.enum(["success", "failed"]);
export const MapPluginMissionTerminalStatusSchema = z.enum(["completed", "failed", "stopped"]);
