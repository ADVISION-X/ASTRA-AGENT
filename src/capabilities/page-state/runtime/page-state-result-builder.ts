import { PAGE_STATE_ABILITY_GROUP_ID, PageStateAbilityResultSchema } from "../schema.js";
import type { PageStateAbilityInput, PageStateAbilityResult, PageStateRuntimeProof } from "../schema.js";
import type { PageStateClassificationOutcome } from "../shared/page-state-types.js";

export function buildPageStateResult(input: {
  request: PageStateAbilityInput;
  outcome: PageStateClassificationOutcome;
  runtimeProof: PageStateRuntimeProof;
  observationRefs: readonly string[];
  pageStateFingerprint: string;
}): PageStateAbilityResult {
  return PageStateAbilityResultSchema.parse({
    status: input.outcome.status,
    decision: input.outcome.decision,
    abilityGroupId: PAGE_STATE_ABILITY_GROUP_ID,
    childCapabilityId: input.request.childCapabilityId,
    runId: input.request.runId,
    missionId: input.request.missionId,
    sessionId: input.request.sessionId,
    roundId: input.request.roundId,
    videoVisitId: input.request.videoVisitId,
    pageStateType: input.outcome.pageStateType,
    stateSummary: input.outcome.stateSummary,
    confidence: input.outcome.confidence,
    evidenceRefs: [...input.request.sourceEvidenceRefs],
    observationRefs: [...input.observationRefs],
    sourceEvidenceRefs: [...input.request.sourceEvidenceRefs],
    pageStateFingerprint: input.pageStateFingerprint,
    previousPageStateFingerprint: input.request.previousPageStateFingerprint,
    failureReason: input.outcome.failureReason,
    reviewRequiredReason: input.outcome.reviewRequiredReason,
    dataQualityFlags: [...input.outcome.dataQualityFlags],
    runtimeProof: input.runtimeProof,
  });
}