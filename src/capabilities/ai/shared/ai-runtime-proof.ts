import type { AiAbilityGroupId, AiChildCapabilityId } from "../contract.js";

export type AiRuntimeProofStatus = "success" | "failed" | "review_required";

export type AiRuntimeProof = {
  runId: string;
  missionId: string;
  capabilityId: AiAbilityGroupId;
  abilityGroupId: AiAbilityGroupId;
  childCapabilityId: AiChildCapabilityId;
  inputSummary: string;
  outputSummary: string;
  sessionId: string;
  roundId: string | null;
  videoVisitId: string | null;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  status: AiRuntimeProofStatus;
  reason: string;
  failureReason: string | null;
  reviewRequiredReason: string | null;
  errorCode: string | null;
  inputRefs: string[];
  outputRefs: string[];
  evidenceRefs: string[];
  evidenceRef: string | null;
  actionLogRefs: string[];
  nextAbilityGroup: string | null;
  nextChildAbility: string | null;
  dataQualityFlags: string[];
  timestamp: string;
};