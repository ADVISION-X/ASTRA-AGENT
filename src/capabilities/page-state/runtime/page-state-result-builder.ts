import { PAGE_STATE_ABILITY_GROUP_ID, PageStateAbilityResultSchema } from "../schema.js";
import type { PageStateAbilityInput, PageStateAbilityResult, PageStateRuntimeProof } from "../schema.js";
import type { PageStateClassificationOutcome } from "../shared/page-state-types.js";

function buildPageStateOutput(input: {
  outcome: PageStateClassificationOutcome;
  observationRefs: readonly string[];
  pageStateFingerprint: string;
}) {
  return input.outcome.status === "success"
    ? {
        pageStateType: input.outcome.pageStateType,
        stateSummary: input.outcome.stateSummary,
        confidence: input.outcome.confidence,
        evidenceRefs: [...input.outcome.supportingEvidenceRefs],
        observationRefs: [...input.observationRefs],
        pageStateFingerprint: input.pageStateFingerprint,
      }
    : null;
}

function buildPageStateResultEnvelope(input: {
  request: PageStateAbilityInput;
  outcome: PageStateClassificationOutcome;
  runtimeProof: PageStateRuntimeProof;
  output: ReturnType<typeof buildPageStateOutput>;
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
    stepId: input.request.stepId,
    mapPackageId: input.request.mapPackageId,
    mapPackageVersion: input.request.mapPackageVersion,
    selectedMapId: input.request.selectedMapId,
    selectedMapVersion: input.request.selectedMapVersion,
    activationSnapshotRef: input.request.activationSnapshotRef,
    capabilityCallId: input.request.capabilityCallId,
    nerveBusEnvelopeId: input.request.nerveBusEnvelopeId,
    output: input.output,
    pageStateType: input.output?.pageStateType ?? null,
    stateSummary: input.output?.stateSummary ?? null,
    confidence: input.output?.confidence ?? null,
    evidenceRefs: input.output?.evidenceRefs ?? [],
    observationRefs: input.output?.observationRefs ?? [...input.runtimeProof.observationRefs],
    sourceEvidenceRefs: [...input.request.sourceEvidenceRefs],
    pageStateFingerprint: input.output?.pageStateFingerprint ?? input.runtimeProof.pageStateFingerprint,
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

export function buildPageStateResult(input: {
  request: PageStateAbilityInput;
  outcome: PageStateClassificationOutcome;
  runtimeProof: PageStateRuntimeProof;
  observationRefs: readonly string[];
  pageStateFingerprint: string;
}): PageStateAbilityResult {
  return buildPageStateResultEnvelope({
    request: input.request,
    outcome: input.outcome,
    runtimeProof: input.runtimeProof,
    output: buildPageStateOutput(input),
  });
}