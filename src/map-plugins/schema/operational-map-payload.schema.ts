import { z } from "zod";

export const MapPluginPayloadRefKeySchema = z.enum([
  "requestedPlatformId",
  "selectedMapId",
  "operatorNote",
  "targetUrl",
  "targetTitle",
  "sourceEvidenceRef",
  "sourceTargetRef",
  "sourceAiResultRef",
  "screenshotEvidenceRef",
  "commentsEvidenceRef",
  "visualTargetRef",
  "aiTargetCandidateRef",
  "targetCandidateRef",
  "nextItemTargetCandidateRef",
  "geometryProofRef",
  "nextItemAdvanceProofRef",
  "nextItemVerificationEvidenceRef",
  "nextItemVerificationPromptInputRef",
  "nextItemVerificationResultRef",
  "pageStateRef",
  "aiResultRef",
  "abilityResultRef",
  "promptInputRef",
  "commandInputRef",
  "reviewReasonRef",
  "runtimeLogRef",
] as const);

export const MapPluginStepKindSchema = z.enum(["ability", "ai", "finalize"]);
export const MapPluginTransitionStatusSchema = z.enum(["success", "failed"]);
export const MapPluginMissionTerminalStatusSchema = z.enum(["completed", "failed", "stopped"]);
