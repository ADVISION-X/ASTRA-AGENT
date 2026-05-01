import { createHash } from "node:crypto";

import { PAGE_STATE_ABILITY_GROUP_ID, PageStateRuntimeProofSchema } from "../schema.js";
import type { PageStateAbilityInput, PageStateDataQualityFlag, PageStateFailureReason, PageStateRuntimeProof, PageStateType } from "../schema.js";
import type { PageStateExecutionTiming, PageStateExecutionTrace } from "../shared/page-state-types.js";

function buildPageStateRuntimeProofHashFields(input: {
  request: PageStateAbilityInput;
  timing: PageStateExecutionTiming;
  pageStateFingerprint: string;
}): Pick<PageStateRuntimeProof, "proofId" | "inputPayloadHash" | "snapshotHash" | "observationHash" | "debugLogRef"> {
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

  return {
    proofId: `page-state-proof:${proofId}`,
    inputPayloadHash,
    snapshotHash,
    observationHash,
    debugLogRef: `page-state-debug:${input.request.runId}:${input.request.childCapabilityId}:${proofId}`,
  };
}

function buildPageStateRuntimeProofReferenceFields(input: {
  request: PageStateAbilityInput;
  timing: PageStateExecutionTiming;
  pageStateFingerprint: string;
  diagnosticPayloadRef: string | null;
  structuredRuntimeEventRef: string | null;
  resolvedPlatformProfileId: string | null;
  matchedHost: string | null;
}): Pick<PageStateRuntimeProof,
  | "runId"
  | "missionId"
  | "sessionId"
  | "roundId"
  | "videoVisitId"
  | "abilityGroupId"
  | "childCapabilityId"
  | "inputRef"
  | "outputRef"
  | "diagnosticPayloadRef"
  | "debugLogRef"
  | "structuredRuntimeEventRef"
  | "snapshotId"
  | "snapshotProofRef"
  | "openHandoffProofRef"
  | "browserSessionRef"
  | "platformProfileId"
  | "resolvedPlatformProfileId"
  | "matchedHost"
  | "sourceAbilityGroupId"
  | "sourceChildCapabilityId"
  | "observationRefs"
  | "sourceEvidenceRefs"
  | "currentUrl"
  | "currentTitle"
  | "pageStateFingerprint"
  | "previousPageStateFingerprint"
  | "classificationSource"> {
  return {
    runId: input.request.runId,
    missionId: input.request.missionId,
    sessionId: input.request.sessionId,
    roundId: input.request.roundId,
    videoVisitId: input.request.videoVisitId,
    abilityGroupId: PAGE_STATE_ABILITY_GROUP_ID,
    childCapabilityId: input.request.childCapabilityId,
    inputRef: `page-state-input:${input.request.runId}:${input.request.childCapabilityId}`,
    outputRef: null,
    diagnosticPayloadRef: input.diagnosticPayloadRef ?? null,
    debugLogRef: `page-state-debug:${input.request.runId}:${input.request.childCapabilityId}:${input.request.childCapabilityId}`,
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
    observationRefs: [...input.request.observations.map((observation) => observation.observationId)],
    sourceEvidenceRefs: [...input.request.sourceEvidenceRefs],
    currentUrl: input.request.snapshot.currentUrl,
    currentTitle: input.request.snapshot.currentTitle,
    pageStateFingerprint: input.pageStateFingerprint,
    previousPageStateFingerprint: input.request.previousPageStateFingerprint,
    classificationSource: "child_capability",
  };
}

function buildPageStateRuntimeProofCoreFields(input: {
  request: PageStateAbilityInput;
  timing: PageStateExecutionTiming;
  pageStateFingerprint: string;
  diagnosticPayloadRef: string | null;
  structuredRuntimeEventRef: string | null;
  resolvedPlatformProfileId: string | null;
  matchedHost: string | null;
}): Pick<PageStateRuntimeProof,
  | "proofId"
  | "runId"
  | "missionId"
  | "sessionId"
  | "roundId"
  | "videoVisitId"
  | "abilityGroupId"
  | "childCapabilityId"
  | "inputRef"
  | "outputRef"
  | "diagnosticPayloadRef"
  | "debugLogRef"
  | "structuredRuntimeEventRef"
  | "snapshotId"
  | "snapshotProofRef"
  | "openHandoffProofRef"
  | "browserSessionRef"
  | "platformProfileId"
  | "resolvedPlatformProfileId"
  | "matchedHost"
  | "sourceAbilityGroupId"
  | "sourceChildCapabilityId"
  | "observationRefs"
  | "sourceEvidenceRefs"
  | "inputPayloadHash"
  | "snapshotHash"
  | "observationHash"
  | "currentUrl"
  | "currentTitle"
  | "pageStateFingerprint"
  | "previousPageStateFingerprint"
  | "classificationSource"> {
  const hashFields = buildPageStateRuntimeProofHashFields(input);
  const referenceFields = buildPageStateRuntimeProofReferenceFields({
    request: input.request,
    timing: input.timing,
    pageStateFingerprint: input.pageStateFingerprint,
    diagnosticPayloadRef: input.diagnosticPayloadRef ?? null,
    structuredRuntimeEventRef: input.structuredRuntimeEventRef ?? null,
    resolvedPlatformProfileId: input.resolvedPlatformProfileId ?? null,
    matchedHost: input.matchedHost ?? null,
  });

  return {
    ...hashFields,
    ...referenceFields,
  };
}

function buildPageStateRuntimeProofDecisionFields(input: {
  timing: PageStateExecutionTiming;
  status: "success" | "failed" | "review_required";
  decision: "proceed" | "block" | "review_required" | "fail";
  failureReason: PageStateFailureReason | null;
  reviewRequiredReason: string | null;
  trace: PageStateExecutionTrace;
  pageStateType: PageStateType;
  confidence: number;
  outputBoundaryDecision?: "allow" | "review_required" | "fail";
  criticalDataQualityDecision?: "allow" | "review_required" | "fail";
  dataQualityFlags: readonly PageStateDataQualityFlag[];
}): Pick<PageStateRuntimeProof,
  | "startedAt"
  | "endedAt"
  | "durationMs"
  | "status"
  | "decision"
  | "failureReason"
  | "reviewRequiredReason"
  | "inputDecision"
  | "sourceBindingDecision"
  | "observationBindingDecision"
  | "freshnessDecision"
  | "platformDecision"
  | "classificationDecision"
  | "outputBoundaryDecision"
  | "criticalDataQualityDecision"
  | "proceedDecision"
  | "dataQualityFlags"> {
  return {
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
  };
}

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
  return PageStateRuntimeProofSchema.parse({
    ...buildPageStateRuntimeProofCoreFields({
      request: input.request,
      timing: input.timing,
      pageStateFingerprint: input.pageStateFingerprint,
      diagnosticPayloadRef: input.diagnosticPayloadRef ?? null,
      structuredRuntimeEventRef: input.structuredRuntimeEventRef ?? null,
      resolvedPlatformProfileId: input.resolvedPlatformProfileId ?? null,
      matchedHost: input.matchedHost ?? null,
    }),
    ...buildPageStateRuntimeProofDecisionFields({
      timing: input.timing,
      status: input.status,
      decision: input.decision,
      failureReason: input.failureReason,
      reviewRequiredReason: input.reviewRequiredReason,
      trace: input.trace,
      pageStateType: input.pageStateType,
      confidence: input.confidence,
      outputBoundaryDecision: input.outputBoundaryDecision ?? "allow",
      criticalDataQualityDecision: input.criticalDataQualityDecision ?? "allow",
      dataQualityFlags: input.dataQualityFlags,
    }),
    outputRef: input.status === "success" ? `page-state-output:${input.request.runId}:${input.request.childCapabilityId}` : null,
    receivedShapeHash: input.receivedShapeHash ?? null,
  });
}