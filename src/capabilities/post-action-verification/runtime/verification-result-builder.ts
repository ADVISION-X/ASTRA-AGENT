import { createId } from "../../../lib/local-runtime/ids.js";
import { PostActionVerificationAbilityResultSchema } from "../schema.js";
import type { ParsedPostActionVerificationAbilityInput, PostActionRuntimeProof, PostActionVerificationAbilityResult } from "../contract.js";

export function buildPostActionVerificationResult(input: {
  request: ParsedPostActionVerificationAbilityInput;
  observedOutcome: string;
  confidence: number;
  status: PostActionVerificationAbilityResult["status"];
  verificationDecision: PostActionVerificationAbilityResult["verificationDecision"];
  failureReason: PostActionVerificationAbilityResult["failureReason"];
  reviewRequiredReason: string | null;
  statusMessage: string;
  runtimeProof: PostActionRuntimeProof;
  startedAt: string;
  endedAt: string;
  startedMonotonicMs: number;
  endedMonotonicMs: number;
  dataQualityFlags: string[];
}): PostActionVerificationAbilityResult {
  return PostActionVerificationAbilityResultSchema.parse({
    status: input.status,
    abilityGroupId: input.request.abilityGroupId,
    childCapabilityId: input.request.childCapabilityId,
    sessionId: input.request.sessionId,
    roundId: input.request.roundId,
    videoVisitId: input.request.videoVisitId,
    actionProofRef: input.request.actionProof.actionProofRef,
    expectedOutcome: input.request.expectedOutcome,
    observedOutcome: input.observedOutcome,
    verificationDecision: input.verificationDecision,
    confidence: input.confidence,
    evidenceRefs: [
      ...(input.request.beforeAfterEvidence.beforeEvidence ? [input.request.beforeAfterEvidence.beforeEvidence.evidenceRef] : []),
      ...(input.request.beforeAfterEvidence.afterEvidence ? [input.request.beforeAfterEvidence.afterEvidence.evidenceRef] : []),
    ],
    observationRefs: input.request.observationSet.observations.map((observation) => observation.ref),
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    durationMs: Math.max(0, Math.round(input.endedMonotonicMs - input.startedMonotonicMs)),
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    statusMessage: input.statusMessage,
    debugLogRef: createId("post_action_verification_log"),
    runtimeProof: input.runtimeProof,
    dataQualityFlags: input.dataQualityFlags,
  });
}
