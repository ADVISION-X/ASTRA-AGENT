import { createHash } from "node:crypto";

import { PAGE_STATE_ABILITY_GROUP_ID, PageStateRuntimeProofSchema } from "../schema.js";
import type { PageStateAbilityInput, PageStateDataQualityFlag, PageStateFailureReason, PageStateRuntimeProof, PageStateType } from "../schema.js";
import type { PageStateExecutionTiming, PageStateExecutionTrace } from "../shared/page-state-types.js";

export function buildPageStateRuntimeProof(input: {
  request: PageStateAbilityInput;
  timing: PageStateExecutionTiming;
  trace: PageStateExecutionTrace;
  status: "success" | "failed" | "review_required" | "blocked";
  decision: "proceed" | "block" | "review_required" | "fail";
  pageStateType: PageStateType;
  confidence: number;
  failureReason: PageStateFailureReason | null;
  reviewRequiredReason: string | null;
  pageStateFingerprint: string;
  observationRefs: readonly string[];
  dataQualityFlags: readonly PageStateDataQualityFlag[];
}): PageStateRuntimeProof {
  const proofId = createHash("sha256")
    .update([
      input.request.runId,
      input.request.childCapabilityId,
      input.timing.startedAt.isoTimestamp,
      input.pageStateFingerprint,
    ].join("|"))
    .digest("hex")
    .slice(0, 24);

  return PageStateRuntimeProofSchema.parse({
    proofId: `page-state-proof:${proofId}`,
    runId: input.request.runId,
    missionId: input.request.missionId,
    sessionId: input.request.sessionId,
    roundId: input.request.roundId,
    videoVisitId: input.request.videoVisitId,
    abilityGroupId: PAGE_STATE_ABILITY_GROUP_ID,
    childCapabilityId: input.request.childCapabilityId,
    sourceAbilityGroupId: input.request.snapshot.sourceAbilityGroupId,
    sourceChildCapabilityId: input.request.snapshot.sourceChildCapabilityId,
    inputRef: `page-state-input:${input.request.runId}:${input.request.childCapabilityId}`,
    outputRef: `page-state-output:${input.request.runId}:${input.request.childCapabilityId}`,
    snapshotId: input.request.snapshot.snapshotId,
    snapshotProofRef: input.request.snapshot.sourceProofRef,
    observationRefs: [...input.observationRefs],
    sourceEvidenceRefs: [...input.request.sourceEvidenceRefs],
    currentUrl: input.request.snapshot.currentUrl,
    currentTitle: input.request.snapshot.currentTitle,
    pageStateFingerprint: input.pageStateFingerprint,
    previousPageStateFingerprint: input.request.previousPageStateFingerprint,
    capturedAt: input.request.snapshot.capturedAt,
    startedAt: input.timing.startedAt.isoTimestamp,
    endedAt: input.timing.endedAt.isoTimestamp,
    durationMs: input.timing.endedAt.epochMs - input.timing.startedAt.epochMs,
    status: input.status,
    decision: input.decision,
    pageStateType: input.pageStateType,
    confidence: input.confidence,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    inputDecision: input.trace.inputDecision,
    sourceDecision: input.trace.sourceDecision,
    freshnessDecision: input.trace.freshnessDecision,
    platformDecision: input.trace.platformDecision,
    classificationDecision: input.trace.classificationDecision,
    proceedDecision: input.trace.proceedDecision,
    dataQualityFlags: [...input.dataQualityFlags],
  });
}