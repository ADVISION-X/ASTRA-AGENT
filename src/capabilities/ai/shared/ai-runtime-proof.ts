import type { AiAbilityGroupId, AiChildCapabilityId } from "../contract.js";

export type AiRuntimeProofStatus = "success" | "failed" | "review_required";

export type AiRuntimeProof = {
  abilityGroupId: AiAbilityGroupId;
  childCapabilityId: AiChildCapabilityId;
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
  inputRefs: string[];
  outputRefs: string[];
  evidenceRefs: string[];
  actionLogRefs: string[];
  nextAbilityGroup: string | null;
  nextChildAbility: string | null;
  dataQualityFlags: string[];
};