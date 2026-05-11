import { ZodIssueCode, type RefinementCtx } from "zod";

const CRITICAL_DATA_QUALITY_FLAGS = new Set([
  "missing_observation",
  "stale_snapshot",
  "stale_observation",
  "source_mismatch",
  "insufficient_signal",
]);

type PageStateRuntimeProofLike = {
  status: "success" | "failed" | "review_required";
  processingMode: "observation_packaging" | "invalid_input_failure";
  childCapabilityId: string | null;
  runId: string | null;
  missionId: string | null;
  sessionId: string | null;
  roundId: string | null;
  videoVisitId: string | null;
  stepId: string | null;
  bindingPackageId: string | null;
  bindingPackageVersion: string | null;
  selectedBindingId: string | null;
  bindingVersion: string | null;
  bindingSnapshotRef: string | null;
  capabilityCallId: string | null;
  nerveBusEnvelopeId: string | null;
  observationFingerprint: string | null;
  receivedShapeHash: string | null;
  sourceEvidenceRefs: string[];
  observationRefs: string[];
};

type PageStateAbilityResultLike = {
  status: "success" | "failed" | "review_required";
  childCapabilityId: string | null;
  runId: string | null;
  missionId: string | null;
  sessionId: string | null;
  roundId: string | null;
  videoVisitId: string | null;
  stepId: string | null;
  bindingPackageId: string | null;
  bindingPackageVersion: string | null;
  selectedBindingId: string | null;
  bindingVersion: string | null;
  bindingSnapshotRef: string | null;
  capabilityCallId: string | null;
  nerveBusEnvelopeId: string | null;
  output: {
    packageLabel: string;
    observationSummary: string;
    evidenceRefs: string[];
    observationRefs: string[];
    observationFingerprint: string;
  } | null;
  observationSummary: string | null;
  evidenceRefs: string[];
  observationRefs: string[];
  sourceEvidenceRefs: string[];
  observationFingerprint: string | null;
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
  "bindingPackageId",
  "bindingPackageVersion",
  "selectedBindingId",
  "bindingVersion",
  "bindingSnapshotRef",
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
  "bindingPackageId",
  "bindingPackageVersion",
  "selectedBindingId",
  "bindingVersion",
  "bindingSnapshotRef",
  "capabilityCallId",
  "nerveBusEnvelopeId",
] as const;

const addIssue = (ctx: RefinementCtx, path: string[], message: string): void => {
  ctx.addIssue({ code: ZodIssueCode.custom, message, path });
};

const isMissingString = (value: string | null | undefined): boolean => value == null || value.length === 0;

const arraysMatch = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const isInvalidInputProof = (proof: PageStateRuntimeProofLike): boolean => proof.processingMode === "invalid_input_failure";

function validateResultStatusParity(result: PageStateAbilityResultLike, ctx: RefinementCtx): void {
  if (result.runtimeProof.status !== result.status) {
    addIssue(ctx, ["runtimeProof", "status"], "runtime proof status must match result status");
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

  if (result.observationFingerprint !== result.runtimeProof.observationFingerprint) {
    addIssue(ctx, ["observationFingerprint"], "result observationFingerprint must match runtime proof observationFingerprint");
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
  if (result.observationSummary === null || result.observationFingerprint === null) {
    addIssue(ctx, ["output"], "success result must retain observationSummary and observationFingerprint");
  }
}

function validateSuccessResultEvidence(result: PageStateAbilityResultLike, ctx: RefinementCtx): void {
  if (result.evidenceRefs.length === 0) {
    addIssue(ctx, ["evidenceRefs"], "success result must retain evidenceRefs");
  }
  if (result.sourceEvidenceRefs.length === 0) {
    addIssue(ctx, ["sourceEvidenceRefs"], "success result must retain sourceEvidenceRefs");
  }
  if (result.observationRefs.length === 0) {
    addIssue(ctx, ["observationRefs"], "success result must retain observationRefs");
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

  if (result.output.observationSummary !== result.observationSummary) {
    addIssue(ctx, ["output", "observationSummary"], "success output observationSummary must match result observationSummary");
  }
  if (result.output.observationFingerprint !== result.observationFingerprint) {
    addIssue(ctx, ["output", "observationFingerprint"], "success output observationFingerprint must match result observationFingerprint");
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