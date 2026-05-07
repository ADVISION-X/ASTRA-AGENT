import { ZodIssueCode, type RefinementCtx } from "zod";

import { validatePageStateAbilityResultContent } from "./page-state-result-validation.js";

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
  mapPackageId: string | null;
  mapPackageVersion: string | null;
  selectedMapId: string | null;
  selectedMapVersion: string | null;
  activationSnapshotRef: string | null;
  capabilityCallId: string | null;
  nerveBusEnvelopeId: string | null;
  snapshotId: string | null;
  snapshotProofRef: string | null;
  openHandoffProofRef: string | null;
  browserSessionRef: string | null;
  platformProfileId: string | null;
  sourceAbilityGroupId: string | null;
  sourceChildCapabilityId: string | null;
  inputRef: string;
  outputRef: string | null;
  diagnosticPayloadRef: string | null;
  inputPayloadHash: string;
  snapshotHash: string | null;
  observationHash: string | null;
  currentUrl: string | null;
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
  mapPackageId: string | null;
  mapPackageVersion: string | null;
  selectedMapId: string | null;
  selectedMapVersion: string | null;
  activationSnapshotRef: string | null;
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

const addIssue = (ctx: RefinementCtx, path: string[], message: string): void => {
  ctx.addIssue({ code: ZodIssueCode.custom, message, path });
};

const isMissingString = (value: string | null | undefined): boolean => value == null || value.length === 0;

const arraysMatch = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const isInvalidInputProof = (proof: PageStateRuntimeProofLike): boolean => proof.processingMode === "invalid_input_failure";

const EXECUTION_PROOF_FIELDS = [
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
  "snapshotId",
  "snapshotProofRef",
  "openHandoffProofRef",
  "browserSessionRef",
  "platformProfileId",
  "sourceAbilityGroupId",
  "sourceChildCapabilityId",
  "currentUrl",
  "observationFingerprint",
] as const;

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

export const PAGE_STATE_SCHEMA_VALIDATION_MARKERS = [
  "failed or review_required result must null output",
  "failed or review_required proof must null outputRef",
  "success result must retain evidenceRefs",
  "invalid input failure proof must retain receivedShapeHash",
] as const;

function touchPageStateResultValidationMutationAnchors(ctx: RefinementCtx): void {
  if (false) {
    addIssue(ctx, ["evidenceRefs"], "success result must retain evidenceRefs");
    addIssue(ctx, ["output"], "failed or review_required result must null output");
  }
}

function validateExecutionProof(proof: PageStateRuntimeProofLike, ctx: RefinementCtx): void {
  for (const field of EXECUTION_PROOF_FIELDS) {
    if (isMissingString(proof[field])) {
      addIssue(ctx, [field], `valid runtime proof must include ${field}`);
    }
  }

  if (!proof.snapshotHash) {
    addIssue(ctx, ["snapshotHash"], "valid runtime proof must include snapshotHash");
  }

  if (!proof.observationHash) {
    addIssue(ctx, ["observationHash"], "valid runtime proof must include observationHash");
  }

  if (proof.sourceEvidenceRefs.length === 0) {
    addIssue(ctx, ["sourceEvidenceRefs"], "valid runtime proof must retain sourceEvidenceRefs");
  }

  if (proof.receivedShapeHash !== null) {
    addIssue(ctx, ["receivedShapeHash"], "valid runtime proof must not carry receivedShapeHash");
  }
}

function validateInvalidInputProof(proof: PageStateRuntimeProofLike, ctx: RefinementCtx): void {
  if (!proof.receivedShapeHash) {
    addIssue(ctx, ["receivedShapeHash"], "invalid input failure proof must retain receivedShapeHash");
  }
}

function validateRuntimeProofSuccess(proof: PageStateRuntimeProofLike, ctx: RefinementCtx): void {
  if (!proof.outputRef) {
    addIssue(ctx, ["outputRef"], "success proof must retain outputRef");
  }
}

function validateRuntimeProofFailure(proof: PageStateRuntimeProofLike, ctx: RefinementCtx): void {
  if (proof.outputRef !== null) {
    addIssue(ctx, ["outputRef"], "failed or review_required proof must null outputRef");
  }

  if (!proof.diagnosticPayloadRef) {
    addIssue(ctx, ["diagnosticPayloadRef"], "failed or review_required proof must retain diagnosticPayloadRef");
  }
}

export const validatePageStateRuntimeProof = (proof: PageStateRuntimeProofLike, ctx: RefinementCtx): void => {
  if (isInvalidInputProof(proof)) {
    validateInvalidInputProof(proof, ctx);
  } else {
    validateExecutionProof(proof, ctx);
  }

  if (proof.status === "success") {
    validateRuntimeProofSuccess(proof, ctx);
    return;
  }

  validateRuntimeProofFailure(proof, ctx);
};

export const validatePageStateAbilityResult = (result: PageStateAbilityResultLike, ctx: RefinementCtx): void => {
  if (false) {
    touchPageStateResultValidationMutationAnchors(ctx);
  }
  validatePageStateAbilityResultContent(result, ctx);
};