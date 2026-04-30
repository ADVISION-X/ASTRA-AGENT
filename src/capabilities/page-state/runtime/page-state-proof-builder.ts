import { createHash } from "node:crypto";

import { PAGE_STATE_ABILITY_GROUP_ID, PageStateRuntimeProofSchema } from "../schema.js";
import type { PageStateAbilityInput, PageStateDataQualityFlag, PageStateFailureReason, PageStateRuntimeProof, PageStateType } from "../schema.js";
import type { PageStateExecutionTiming, PageStateExecutionTrace } from "../shared/page-state-types.js";

export function buildPageStateRuntimeProof(input: {
  request: PageStateAbilityInput;
  timing: PageStateExecutionTiming;
  trace: PageStateExecutionTrace;
  status: "success" | "failed" | "review_required";
  decision: "proceed" | "block" | "review_required" | "fail";
  pageStateType: PageStateType;
  confidence: number;
  failureReason: PageStateFailureReason | null;
  reviewRequiredReason: string | null;
  pageStateFingerprint: string;
  observationRefs: readonly string[];
  dataQualityFlags: readonly PageStateDataQualityFlag[];
  resolvedPlatformProfileId?: string | null;
  matchedHost?: string | null;
  outputBoundaryDecision?: "allow" | "review_required" | "fail";
  criticalDataQualityDecision?: "allow" | "review_required" | "fail";
  diagnosticPayloadRef?: string | null;
  structuredRuntimeEventRef?: string | null;
  receivedShapeHash?: string | null;
}): PageStateRuntimeProof {
  const inputPayloadHash = createHash("sha256")
    .update(JSON.stringify(input.request))
    .digest("hex");
  const snapshotHash = createHash("sha256")
    .update(JSON.stringify(input.request.snapshot))
    .digest("hex");
  const observationHash = createHash("sha256")
    .update(JSON.stringify(input.request.observations))
    .digest("hex");
  const proofId = createHash("sha256")
    .update([
      input.request.runId,
      input.request.childCapabilityId,
      input.timing.startedAt.isoTimestamp,
      input.pageStateFingerprint,
    ].join("|"))
    .digest("hex")
    .slice(0, 24);

  const debugLogRef = `page-state-debug:${input.request.runId}:${input.request.childCapabilityId}:${proofId}`;
  const diagnosticPayloadRef = input.diagnosticPayloadRef ?? (input.status === "success" ? null : `page-state-diagnostic:${proofId}`);

  return PageStateRuntimeProofSchema.parse({
    proofId: `page-state-proof:${proofId}`,
    runId: input.request.runId,
    missionId: input.request.missionId,
    sessionId: input.request.sessionId,
    roundId: input.request.roundId,
    videoVisitId: input.request.videoVisitId,
    abilityGroupId: PAGE_STATE_ABILITY_GROUP_ID,
    childCapabilityId: input.request.childCapabilityId,
    inputRef: `page-state-input:${input.request.runId}:${input.request.childCapabilityId}`,
    outputRef: input.status === "success" ? `page-state-output:${input.request.runId}:${input.request.childCapabilityId}` : null,
    diagnosticPayloadRef,
    debugLogRef,
    structuredRuntimeEventRef: input.structuredRuntimeEventRef ?? null,
    snapshotId: input.request.snapshot.snapshotId,
    snapshotProofRef: input.request.snapshot.sourceProofRef,
    openHandoffProofRef: input.request.openHandoff.openProofRef,
    browserSessionRef: input.request.openHandoff.browserSessionRef,
    platformProfileId: input.request.openHandoff.platformProfileId,
    resolvedPlatformProfileId: input.resolvedPlatformProfileId ?? null,
    matchedHost: input.matchedHost ?? null,
    sourceAbilityGroupId: input.request.snapshot.sourceAbilityGroupId,
    sourceChildCapabilityId: input.request.snapshot.sourceChildCapabilityId,
    observationRefs: [...input.observationRefs],
    sourceEvidenceRefs: [...input.request.sourceEvidenceRefs],
    inputPayloadHash,
    snapshotHash,
    observationHash,
    currentUrl: input.request.snapshot.currentUrl,
    currentTitle: input.request.snapshot.currentTitle,
    pageStateFingerprint: input.pageStateFingerprint,
    previousPageStateFingerprint: input.request.previousPageStateFingerprint,
    classificationSource: "child_capability",
    startedAt: input.timing.startedAt.isoTimestamp,
    endedAt: input.timing.endedAt.isoTimestamp,
    durationMs: input.timing.endedAt.epochMs - input.timing.startedAt.epochMs,
    status: input.status,
    decision: input.decision,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    inputDecision: input.trace.inputDecision,
    sourceBindingDecision: input.trace.sourceDecision,
    observationBindingDecision: "bound",
    freshnessDecision: input.trace.freshnessDecision,
    platformDecision: input.trace.platformDecision,
    classificationDecision: input.trace.classificationDecision,
    outputBoundaryDecision: input.outputBoundaryDecision ?? "allow",
    criticalDataQualityDecision: input.criticalDataQualityDecision ?? "allow",
    proceedDecision: input.trace.proceedDecision,
    dataQualityFlags: [...input.dataQualityFlags],
    receivedShapeHash: input.receivedShapeHash ?? null,
  });
}