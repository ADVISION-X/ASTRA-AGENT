import type { AiAbilityInput, AiAbilityResult, AiChildCapabilityId, AiExecutionStatus } from "../contract.js";

type BuildAiRuntimeProofInput = {
  request: AiAbilityInput;
  childCapabilityId: AiChildCapabilityId;
  status: AiExecutionStatus;
  startedAt: string;
  endedAt: string;
  reason: string;
  failureReason: string | null;
  reviewRequiredReason: string | null;
  dataQualityFlags: string[];
  outputRefs?: string[];
};

export function buildAiRuntimeProof(input: BuildAiRuntimeProofInput): AiAbilityResult["runtimeProof"] {
  const durationMs = Math.max(0, new Date(input.endedAt).getTime() - new Date(input.startedAt).getTime());
  const outputRefs = input.outputRefs ?? [];
  const evidenceRefs = input.request.inputRefs.map((ref) => ref.id);
  return {
    runId: `${input.request.sessionId}:${input.childCapabilityId}:${input.request.roundId ?? "no-round"}`,
    missionId: input.request.sessionId,
    capabilityId: "ai",
    abilityGroupId: "ai",
    childCapabilityId: input.childCapabilityId,
    inputSummary: `${input.request.taskType}:${input.request.inputRefs.length} input refs`,
    outputSummary: outputRefs.length > 0 ? `${outputRefs.length} output refs` : input.reason,
    sessionId: input.request.sessionId,
    roundId: input.request.roundId,
    videoVisitId: input.request.videoVisitId,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    durationMs,
    status: input.status,
    reason: input.reason,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    errorCode: input.failureReason,
    inputRefs: input.request.inputRefs.map((ref) => ref.id),
    outputRefs,
    evidenceRefs,
    evidenceRef: evidenceRefs[0] ?? null,
    actionLogRefs: [],
    nextAbilityGroup: null,
    nextChildAbility: null,
    dataQualityFlags: input.dataQualityFlags,
    timestamp: input.endedAt,
  };
}