import { createHash } from "node:crypto";

import { PAGE_STATE_ABILITY_GROUP_ID, PageStateRuntimeProofSchema } from "../schema.js";
import type { PageStateAbilityInput, PageStateDataQualityFlag, PageStateFailureReason, PageStateRuntimeProof, PageStateType } from "../schema.js";
import type { PageStateExecutionTiming, PageStateExecutionTrace } from "../shared/page-state-types.js";

function hashJson(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function buildPageStateRuntimeProofHashFields(input: {
  request: PageStateAbilityInput;
}): Pick<PageStateRuntimeProof, "proofId" | "inputPayloadHash" | "snapshotHash" | "observationHash"> {
  const inputPayloadHash = hashJson(input.request);
  const snapshotHash = hashJson(input.request.snapshot);
  const observationHash = hashJson(input.request.observations);
  const proofId = createHash("sha256")
    .update([
      input.request.runId,
      input.request.stepId,
      input.request.capabilityCallId,
      inputPayloadHash,
      snapshotHash,
      observationHash,
    ].join("|"))
    .digest("hex")
    .slice(0, 24);

  return {
    proofId: `page-state-proof:${proofId}`,
    inputPayloadHash,
    snapshotHash,
    observationHash,
  };
}

function buildPageStateRuntimeProofReferenceFields(input: {
  request: PageStateAbilityInput;
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
  | "stepId"
  | "mapPackageId"
  | "mapPackageVersion"
  | "selectedMapId"
  | "selectedMapVersion"
  | "activationSnapshotRef"
  | "capabilityCallId"
  | "nerveBusEnvelopeId"
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
    stepId: input.request.stepId,
    mapPackageId: input.request.mapPackageId,
    mapPackageVersion: input.request.mapPackageVersion,
    selectedMapId: input.request.selectedMapId,
    selectedMapVersion: input.request.selectedMapVersion,
    activationSnapshotRef: input.request.activationSnapshotRef,
    capabilityCallId: input.request.capabilityCallId,
    nerveBusEnvelopeId: input.request.nerveBusEnvelopeId,
    abilityGroupId: PAGE_STATE_ABILITY_GROUP_ID,
    childCapabilityId: input.request.childCapabilityId,
    inputRef: input.request.inputRef,
    outputRef: null,
    diagnosticPayloadRef: input.diagnosticPayloadRef,
    debugLogRef: `page-state-debug:${input.request.runId}:${input.request.stepId}:${input.request.capabilityCallId}`,
    structuredRuntimeEventRef: input.structuredRuntimeEventRef,
    snapshotId: input.request.snapshot.snapshotId,
    snapshotProofRef: input.request.snapshot.sourceProofRef,
    openHandoffProofRef: input.request.openHandoff.openProofRef,
    browserSessionRef: input.request.openHandoff.browserSessionRef,
    platformProfileId: input.request.openHandoff.platformProfileId,
    resolvedPlatformProfileId: input.resolvedPlatformProfileId,
    matchedHost: input.matchedHost,
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

function buildPageStateRuntimeProofDecisionFields(input: {
  timing: PageStateExecutionTiming;
  trace: PageStateExecutionTrace;
  status: "success" | "failed" | "review_required";
  decision: "proceed" | "block" | "review_required" | "fail";
  failureReason: PageStateFailureReason | null;
  reviewRequiredReason: string | null;
  pageStateType: PageStateType;
  confidence: number;
  outputBoundaryDecision?: "allow" | "review_required" | "fail" | undefined;
  criticalDataQualityDecision?: "allow" | "review_required" | "fail" | undefined;
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
  | "payloadBudgetDecision"
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
    payloadBudgetDecision: input.trace.payloadBudgetDecision,
    sourceBindingDecision: input.trace.sourceDecision,
    observationBindingDecision: input.trace.observationBindingDecision,
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
    ...buildPageStateRuntimeProofHashFields({ request: input.request }),
    ...buildPageStateRuntimeProofReferenceFields({
      request: input.request,
      pageStateFingerprint: input.pageStateFingerprint,
      diagnosticPayloadRef: input.diagnosticPayloadRef ?? null,
      structuredRuntimeEventRef: input.structuredRuntimeEventRef ?? null,
      resolvedPlatformProfileId: input.resolvedPlatformProfileId ?? null,
      matchedHost: input.matchedHost ?? null,
    }),
    ...buildPageStateRuntimeProofDecisionFields({
      timing: input.timing,
      trace: input.trace,
      status: input.status,
      decision: input.decision,
      failureReason: input.failureReason,
      reviewRequiredReason: input.reviewRequiredReason,
      pageStateType: input.pageStateType,
      confidence: input.confidence,
      outputBoundaryDecision: input.outputBoundaryDecision,
      criticalDataQualityDecision: input.criticalDataQualityDecision,
      dataQualityFlags: input.dataQualityFlags,
    }),
    outputRef: input.status === "success" ? `page-state-output:${input.request.capabilityCallId}` : null,
    receivedShapeHash: input.receivedShapeHash ?? null,
  });
}