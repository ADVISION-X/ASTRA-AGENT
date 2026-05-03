import { ZodIssueCode, type RefinementCtx } from "zod";

const OBSERVATION_REQUIRED_CHILDREN = new Set([
  "detect-feed-ready",
  "detect-video-stable",
  "detect-comment-panel-state",
  "detect-modal-overlay-state",
  "detect-safety-page",
]);

const CRITICAL_DATA_QUALITY_FLAGS = new Set([
  "low_confidence",
  "missing_observation",
  "stale_snapshot",
  "stale_observation",
  "source_mismatch",
  "platform_mismatch",
  "insufficient_signal",
]);

type PageStateRuntimeProofLike = {
  status: "success" | "failed" | "review_required";
  decision: "proceed" | "block" | "review_required" | "fail";
  classificationSource: "child_capability" | "invalid_input_failure";
  childCapabilityId: string | null;
  runId: string | null;
  missionId: string | null;
  sessionId: string | null;
  roundId: string | null;
  videoVisitId: string | null;
  stepId: string | null;
  mapPackageId: string | null;
  mapPackageVersion: string | null;
  selectedMapId: string | null;
  selectedMapVersion: string | null;
  activationSnapshotRef: string | null;
  capabilityCallId: string | null;
  nerveBusEnvelopeId: string | null;
  pageStateFingerprint: string | null;
  receivedShapeHash: string | null;
  sourceEvidenceRefs: string[];
  observationRefs: string[];
};

type PageStateAbilityResultLike = {
  status: "success" | "failed" | "review_required";
  decision: "proceed" | "block" | "review_required" | "fail";
  childCapabilityId: string | null;
  runId: string | null;
  missionId: string | null;
  sessionId: string | null;
  roundId: string | null;
  videoVisitId: string | null;
  stepId: string | null;
  mapPackageId: string | null;
  mapPackageVersion: string | null;
  selectedMapId: string | null;
  selectedMapVersion: string | null;
  activationSnapshotRef: string | null;
  capabilityCallId: string | null;
  nerveBusEnvelopeId: string | null;
  output: {
    pageStateType: string;
    stateSummary: string;
    confidence: number;
    evidenceRefs: string[];
    observationRefs: string[];
    pageStateFingerprint: string;
  } | null;
  pageStateType: string | null;
  stateSummary: string | null;
  confidence: number | null;
  evidenceRefs: string[];
  observationRefs: string[];
  sourceEvidenceRefs: string[];
  pageStateFingerprint: string | null;
  failureReason: string | null;
  reviewRequiredReason: string | null;
  dataQualityFlags: string[];
  diagnosticPayloadRef: string | null;
  receivedShapeHash: string | null;
  runtimeProof: PageStateRuntimeProofLike;
};

const EXECUTION_RESULT_FIELDS = [
  "childCapabilityId",
  "runId",
  "missionId",
  "sessionId",
  "stepId",
  "mapPackageId",
  "mapPackageVersion",
  "selectedMapId",
  "selectedMapVersion",
  "activationSnapshotRef",
  "capabilityCallId",
  "nerveBusEnvelopeId",
] as const;

const RESULT_PARITY_FIELDS = [
  "childCapabilityId",
  "runId",
  "missionId",
  "sessionId",
  "roundId",
  "videoVisitId",
  "stepId",
  "mapPackageId",
  "mapPackageVersion",
  "selectedMapId",
  "selectedMapVersion",
  "activationSnapshotRef",
  "capabilityCallId",
  "nerveBusEnvelopeId",
] as const;

const addIssue = (ctx: RefinementCtx, path: string[], message: string): void => {
  ctx.addIssue({ code: ZodIssueCode.custom, message, path });
};

const isMissingString = (value: string | null | undefined): boolean => value == null || value.length === 0;

const arraysMatch = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const isInvalidInputProof = (proof: PageStateRuntimeProofLike): boolean => proof.classificationSource === "invalid_input_failure";

function validateResultStatusParity(result: PageStateAbilityResultLike, ctx: RefinementCtx): void {
  if (result.runtimeProof.status !== result.status) {
    addIssue(ctx, ["runtimeProof", "status"], "runtime proof status must match result status");
  }

  if (result.runtimeProof.decision !== result.decision) {
    addIssue(ctx, ["runtimeProof", "decision"], "runtime proof decision must match result decision");
  }
}

function validateResultChainParity(result: PageStateAbilityResultLike, ctx: RefinementCtx): void {
  for (const field of RESULT_PARITY_FIELDS) {
    if (result[field] !== result.runtimeProof[field]) {
      addIssue(ctx, [field], `result ${field} must match runtime proof ${field}`);
    }
  }
}

function validateResultReferenceParity(result: PageStateAbilityResultLike, ctx: RefinementCtx): void {
  if (!arraysMatch(result.sourceEvidenceRefs, result.runtimeProof.sourceEvidenceRefs)) {
    addIssue(ctx, ["sourceEvidenceRefs"], "result sourceEvidenceRefs must match runtime proof sourceEvidenceRefs");
  }

  if (!arraysMatch(result.observationRefs, result.runtimeProof.observationRefs)) {
    addIssue(ctx, ["observationRefs"], "result observationRefs must match runtime proof observationRefs");
  }

  if (result.pageStateFingerprint !== result.runtimeProof.pageStateFingerprint) {
    addIssue(ctx, ["pageStateFingerprint"], "result pageStateFingerprint must match runtime proof pageStateFingerprint");
  }
}

function validateExecutionResultChain(result: PageStateAbilityResultLike, ctx: RefinementCtx): void {
  for (const field of EXECUTION_RESULT_FIELDS) {
    if (isMissingString(result[field])) {
      addIssue(ctx, [field], `valid result must include ${field}`);
    }
  }

  if (result.sourceEvidenceRefs.length === 0) {
    addIssue(ctx, ["sourceEvidenceRefs"], "valid result must retain sourceEvidenceRefs");
  }
  if (result.receivedShapeHash !== null) {
    addIssue(ctx, ["receivedShapeHash"], "valid result must not carry receivedShapeHash");
  }
}

function validateInvalidInputResult(result: PageStateAbilityResultLike, ctx: RefinementCtx): void {
  if (!result.receivedShapeHash) {
    addIssue(ctx, ["receivedShapeHash"], "invalid input result must retain receivedShapeHash");
  }
  if (result.receivedShapeHash !== result.runtimeProof.receivedShapeHash) {
    addIssue(ctx, ["receivedShapeHash"], "invalid input result must match runtime proof receivedShapeHash");
  }
}

function validateSuccessResultEnvelope(result: PageStateAbilityResultLike, ctx: RefinementCtx): void {
  if (!result.output) {
    addIssue(ctx, ["output"], "success result must include output");
  }
  if (result.decision !== "proceed") {
    addIssue(ctx, ["decision"], "success result must proceed");
  }
  if (result.pageStateType === null || result.stateSummary === null || result.confidence === null || result.pageStateFingerprint === null) {
    addIssue(ctx, ["output"], "success result must retain pageStateType, stateSummary, confidence, and pageStateFingerprint");
  }
}

function validateSuccessResultEvidence(result: PageStateAbilityResultLike, ctx: RefinementCtx): void {
  if (result.evidenceRefs.length === 0) {
    addIssue(ctx, ["evidenceRefs"], "success result must retain evidenceRefs");
  }
  if (result.sourceEvidenceRefs.length === 0) {
    addIssue(ctx, ["sourceEvidenceRefs"], "success result must retain sourceEvidenceRefs");
  }
  if (result.childCapabilityId && OBSERVATION_REQUIRED_CHILDREN.has(result.childCapabilityId) && result.observationRefs.length === 0) {
    addIssue(ctx, ["observationRefs"], "observation-required child must retain observationRefs on success");
  }
}

function validateSuccessResultFlags(result: PageStateAbilityResultLike, ctx: RefinementCtx): void {
  const criticalFlag = result.dataQualityFlags.find((flag) => CRITICAL_DATA_QUALITY_FLAGS.has(flag));
  if (criticalFlag) {
    addIssue(ctx, ["dataQualityFlags"], `success result cannot retain critical data-quality flag ${criticalFlag}`);
  }
}

function validateSuccessOutputParity(result: PageStateAbilityResultLike, ctx: RefinementCtx): void {
  if (!result.output) {
    return;
  }

  if (result.output.pageStateType !== result.pageStateType) {
    addIssue(ctx, ["output", "pageStateType"], "success output pageStateType must match result pageStateType");
  }
  if (result.output.stateSummary !== result.stateSummary) {
    addIssue(ctx, ["output", "stateSummary"], "success output stateSummary must match result stateSummary");
  }
  if (result.output.confidence !== result.confidence) {
    addIssue(ctx, ["output", "confidence"], "success output confidence must match result confidence");
  }
  if (result.output.pageStateFingerprint !== result.pageStateFingerprint) {
    addIssue(ctx, ["output", "pageStateFingerprint"], "success output pageStateFingerprint must match result pageStateFingerprint");
  }
  if (!arraysMatch(result.output.evidenceRefs, result.evidenceRefs)) {
    addIssue(ctx, ["output", "evidenceRefs"], "success output evidenceRefs must match result evidenceRefs");
  }
  if (!arraysMatch(result.output.observationRefs, result.observationRefs)) {
    addIssue(ctx, ["output", "observationRefs"], "success output observationRefs must match result observationRefs");
  }
}

function validateFailureResultEnvelope(result: PageStateAbilityResultLike, ctx: RefinementCtx): void {
  if (result.output !== null) {
    addIssue(ctx, ["output"], "failed or review_required result must null output");
  }
  if (result.decision === "proceed") {
    addIssue(ctx, ["decision"], "failed or review_required result cannot proceed");
  }
  if (!result.diagnosticPayloadRef) {
    addIssue(ctx, ["diagnosticPayloadRef"], "failed or review_required result must retain diagnosticPayloadRef");
  }
}

function validateFailureResultReasons(result: PageStateAbilityResultLike, ctx: RefinementCtx): void {
  if (result.status === "failed" && !result.failureReason) {
    addIssue(ctx, ["failureReason"], "failed result must retain failureReason");
  }
  if (result.status === "review_required" && !result.reviewRequiredReason) {
    addIssue(ctx, ["reviewRequiredReason"], "review_required result must retain reviewRequiredReason");
  }
  if (!result.failureReason && !result.reviewRequiredReason) {
    addIssue(ctx, ["failureReason"], "failed or review_required result must retain failureReason or reviewRequiredReason");
  }
}

function validateFailureResult(result: PageStateAbilityResultLike, ctx: RefinementCtx): void {
  validateFailureResultEnvelope(result, ctx);
  validateFailureResultReasons(result, ctx);
}

export function validatePageStateAbilityResultContent(result: PageStateAbilityResultLike, ctx: RefinementCtx): void {
  validateResultStatusParity(result, ctx);
  validateResultChainParity(result, ctx);
  validateResultReferenceParity(result, ctx);

  if (isInvalidInputProof(result.runtimeProof)) {
    validateInvalidInputResult(result, ctx);
  } else {
    validateExecutionResultChain(result, ctx);
  }

  if (result.status === "success") {
    validateSuccessResultEnvelope(result, ctx);
    validateSuccessResultEvidence(result, ctx);
    validateSuccessResultFlags(result, ctx);
    validateSuccessOutputParity(result, ctx);
    return;
  }

  validateFailureResult(result, ctx);
}