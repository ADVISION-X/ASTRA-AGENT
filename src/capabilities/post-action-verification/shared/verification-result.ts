import {
  POST_ACTION_VERIFICATION_ABILITY_GROUP_ID,
  type PostActionFailureReason,
  type PostActionVerificationAbilityInput,
  type PostActionVerificationAbilityResult,
  type PostActionVerificationDecision,
} from "../contract.js";
import { collectEvidenceRefs } from "./evidence-comparison.js";
import { collectObservationRefIds } from "./observation-utils.js";

type BuildResultInput = {
  input: PostActionVerificationAbilityInput;
  observedOutcome: string;
  verificationDecision: PostActionVerificationDecision;
  confidence: number;
  failureReason: PostActionFailureReason | null;
  reviewRequiredReason: string | null;
  dataQualityFlags?: string[];
  startedAt: string;
  endedAt: string;
};

export function buildVerificationResult(input: BuildResultInput): PostActionVerificationAbilityResult {
  return {
    status: "success",
    abilityGroupId: POST_ACTION_VERIFICATION_ABILITY_GROUP_ID,
    childCapabilityId: input.input.childCapabilityId,
    sessionId: input.input.sessionId,
    roundId: input.input.roundId,
    videoVisitId: input.input.videoVisitId,
    actionLogRef: input.input.actionLogRef,
    expectedOutcome: input.input.expectedOutcome,
    observedOutcome: input.observedOutcome,
    verificationDecision: input.verificationDecision,
    confidence: input.confidence,
    evidenceRefs: collectEvidenceRefs(input.input),
    observationRefs: collectObservationRefIds(input.input),
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    durationMs: Math.max(0, Date.parse(input.endedAt) - Date.parse(input.startedAt)),
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    dataQualityFlags: input.dataQualityFlags ?? [],
    debugLogRef: `${input.input.actionLogRef}:post-action-verification:${input.input.childCapabilityId}`,
  };
}

export function buildExecutionFailure(input: {
  verificationInput: PostActionVerificationAbilityInput;
  observedOutcome: string;
  failureReason: PostActionFailureReason;
  reviewRequiredReason: string | null;
  startedAt: string;
  endedAt: string;
}): PostActionVerificationAbilityResult {
  return {
    ...buildVerificationResult({
      input: input.verificationInput,
      observedOutcome: input.observedOutcome,
      verificationDecision: input.reviewRequiredReason ? "review_required" : "failed",
      confidence: 0,
      failureReason: input.failureReason,
      reviewRequiredReason: input.reviewRequiredReason,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      dataQualityFlags: input.reviewRequiredReason ? ["review_required"] : [],
    }),
    status: "failed",
  };
}