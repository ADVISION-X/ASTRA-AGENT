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
  const output = input.outcome.status === "success"
    ? {
        pageStateType: input.outcome.pageStateType,
        stateSummary: input.outcome.stateSummary,
        confidence: input.outcome.confidence,
        evidenceRefs: [...input.outcome.supportingEvidenceRefs],
        observationRefs: [...input.observationRefs],
        pageStateFingerprint: input.pageStateFingerprint,
      }
    : null;

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
    output,
    pageStateType: output?.pageStateType ?? null,
    stateSummary: output?.stateSummary ?? null,
    confidence: output?.confidence ?? null,
    evidenceRefs: output?.evidenceRefs ?? [],
    observationRefs: output?.observationRefs ?? [],
    sourceEvidenceRefs: [...input.request.sourceEvidenceRefs],
    pageStateFingerprint: output?.pageStateFingerprint ?? null,
    previousPageStateFingerprint: input.request.previousPageStateFingerprint,
    failureReason: input.outcome.failureReason,
    reviewRequiredReason: input.outcome.reviewRequiredReason,
    dataQualityFlags: [...input.outcome.dataQualityFlags],
    debugLogRef: input.runtimeProof.debugLogRef,
    structuredRuntimeEventRef: input.runtimeProof.structuredRuntimeEventRef,
    diagnosticPayloadRef: input.runtimeProof.diagnosticPayloadRef,
    runtimeProof: input.runtimeProof,
  });
}