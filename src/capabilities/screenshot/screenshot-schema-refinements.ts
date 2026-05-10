import { z } from "zod";

import {
  SCREENSHOT_PROOF_REQUIRED_CHAIN_FIELD_NAMES,
  SCREENSHOT_RESULT_CHAIN_FIELD_NAMES,
  SCREENSHOT_RESULT_REQUIRED_CHAIN_FIELD_NAMES,
} from "./shared/screenshot-governance.js";

type ScreenshotFailureLike = {
  code: string;
};

type ScreenshotScaleMappingLike = {
  sourceScreenshotEvidenceId: string | null;
};

type ScreenshotRuntimeProofValidationTarget = {
  failureReason: ScreenshotFailureLike | null;
  startedAt: string;
  endedAt: string;
  status: string;
  artifactRef: unknown | null;
  screenshotEvidenceId: string | null;
  outputHash: string | null;
  outputWidth: number | null;
  outputHeight: number | null;
  artifactLifecycleManifestRef: string | null;
  artifactHash: string | null;
  byteSize: number | null;
  retentionClass: string | null;
  promotionStatus: string | null;
  cleanupEligible: boolean | null;
  outputRef: string | null;
  diagnosticPayloadRef: string | null;
  childCapabilityId: string;
  scaleMapping: ScreenshotScaleMappingLike | null;
  sourceWidth: number | null;
  sourceHeight: number | null;
  sourceCoordinateSpace: string | null;
  coordinateSpace: string | null;
  dataQualityFlags: string[];
  [key: string]: unknown;
};

type ScreenshotAbilityResultValidationTarget = {
  failureReason: ScreenshotFailureLike | null;
  childCapabilityId: string;
  runtimeProof: ScreenshotRuntimeProofValidationTarget;
  dataQualityFlags: string[];
  status: string;
  output: unknown | null;
  [key: string]: unknown;
};

const isScreenshotInputSchemaInvalid = (value: Pick<ScreenshotRuntimeProofValidationTarget, "failureReason">): boolean => {
  return value.failureReason?.code === "input_schema_invalid";
};

const addMissingChainIssue = (
  fieldName: string,
  subject: "runtimeProof" | "result",
  context: z.RefinementCtx,
): void => {
  context.addIssue({ code: z.ZodIssueCode.custom, message: `${fieldName} is required in ${subject}`, path: [fieldName] });
};

const validateRequiredChainFields = (
  record: Record<string, unknown>,
  fieldNames: readonly string[],
  subject: "runtimeProof" | "result",
  context: z.RefinementCtx,
): void => {
  for (const fieldName of fieldNames) {
    if (record[fieldName] == null) {
      addMissingChainIssue(fieldName, subject, context);
    }
  }
};

const validateScreenshotRuntimeProofChain = (value: ScreenshotRuntimeProofValidationTarget, context: z.RefinementCtx): void => {
  if (isScreenshotInputSchemaInvalid(value)) {
    return;
  }

  validateRequiredChainFields(
    value as Record<string, unknown>,
    SCREENSHOT_PROOF_REQUIRED_CHAIN_FIELD_NAMES,
    "runtimeProof",
    context,
  );
};

const validateScreenshotRuntimeProofTiming = (value: ScreenshotRuntimeProofValidationTarget, context: z.RefinementCtx): void => {
  if (value.startedAt > value.endedAt) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "startedAt must not be after endedAt", path: ["startedAt"] });
  }
};

const validateScreenshotRuntimeProofSuccessArtifactIdentity = (value: ScreenshotRuntimeProofValidationTarget, context: z.RefinementCtx): void => {
  if (value.status === "success" && (!value.artifactRef || !value.screenshotEvidenceId || !value.outputHash || !value.outputWidth || !value.outputHeight)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "success proof requires artifactRef, screenshotEvidenceId, outputHash, and output dimensions", path: ["artifactRef"] });
  }
};

const validateScreenshotRuntimeProofSuccessArtifactLifecycle = (value: ScreenshotRuntimeProofValidationTarget, context: z.RefinementCtx): void => {
  if (value.status === "success" && (!value.artifactLifecycleManifestRef || !value.artifactHash || value.byteSize === null || !value.retentionClass || !value.promotionStatus || value.cleanupEligible === null)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "success proof requires lifecycle manifest, artifact hash, byte size, retention class, promotion status, and cleanup eligibility", path: ["artifactLifecycleManifestRef"] });
  }
};

const validateScreenshotRuntimeProofSuccessArtifacts = (value: ScreenshotRuntimeProofValidationTarget, context: z.RefinementCtx): void => {
  validateScreenshotRuntimeProofSuccessArtifactIdentity(value, context);
  validateScreenshotRuntimeProofSuccessArtifactLifecycle(value, context);
};

const validatePrepareAiInputScaleMapping = (value: ScreenshotRuntimeProofValidationTarget, context: z.RefinementCtx): void => {
  if (value.status === "success" && value.childCapabilityId === "prepare-ai-input" && !value.scaleMapping) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "prepare-ai-input proof requires scaleMapping", path: ["scaleMapping"] });
  }
};

const validateScreenshotRuntimeProofSuccessOutputRef = (value: ScreenshotRuntimeProofValidationTarget, context: z.RefinementCtx): void => {
  if (value.status === "success" && !value.outputRef) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "success proof requires outputRef", path: ["outputRef"] });
  }
};

const validateScreenshotRuntimeProofFailureArtifactExposure = (value: ScreenshotRuntimeProofValidationTarget, context: z.RefinementCtx): void => {
  if (value.status !== "success" && value.artifactRef) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "non-success proof must not expose artifactRef", path: ["artifactRef"] });
  }
  if (value.status !== "success" && value.outputRef) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "non-success proof must not expose outputRef", path: ["outputRef"] });
  }
  if (value.status !== "success" && value.artifactLifecycleManifestRef) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "non-success proof must not expose artifactLifecycleManifestRef", path: ["artifactLifecycleManifestRef"] });
  }
};

const validateScreenshotRuntimeProofFailureDiagnosticExposure = (value: ScreenshotRuntimeProofValidationTarget, context: z.RefinementCtx): void => {
  if (value.status !== "success" && value.diagnosticPayloadRef === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "non-success proof must expose diagnosticPayloadRef", path: ["diagnosticPayloadRef"] });
  }
};

const validateScreenshotRuntimeProofFailureExposure = (value: ScreenshotRuntimeProofValidationTarget, context: z.RefinementCtx): void => {
  validateScreenshotRuntimeProofFailureArtifactExposure(value, context);
  validateScreenshotRuntimeProofFailureDiagnosticExposure(value, context);
};

const validateCaptureRegionScaleMapping = (value: ScreenshotRuntimeProofValidationTarget, context: z.RefinementCtx): void => {
  if (value.status === "success" && value.childCapabilityId === "capture-region" && value.scaleMapping?.sourceScreenshotEvidenceId == null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "capture-region success proof requires sourceScreenshotEvidenceId in scaleMapping", path: ["scaleMapping", "sourceScreenshotEvidenceId"] });
  }
};

const validateOptimizeLosslessProof = (value: ScreenshotRuntimeProofValidationTarget, context: z.RefinementCtx): void => {
  if (value.status !== "success" || value.childCapabilityId !== "optimize-lossless") {
    return;
  }
  if (value.sourceWidth !== value.outputWidth || value.sourceHeight !== value.outputHeight) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "optimize-lossless proof must preserve dimensions", path: ["outputWidth"] });
  }
  if (value.sourceCoordinateSpace !== null && value.coordinateSpace !== value.sourceCoordinateSpace) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "optimize-lossless proof must preserve coordinateSpace", path: ["coordinateSpace"] });
  }
};

const validatePrepareVisualMissionProof = (value: ScreenshotRuntimeProofValidationTarget, context: z.RefinementCtx): void => {
  if (value.status !== "success" || value.childCapabilityId !== "prepare-visual-mission-input") {
    return;
  }

  if ((value as Record<string, unknown>).gridSpecRef == null || (value as Record<string, unknown>).visualMissionInputRef == null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "prepare-visual-mission-input proof requires gridSpecRef and visualMissionInputRef", path: ["gridSpecRef"] });
  }
};

export const validateScreenshotRuntimeProofPrepareAiInput = (value: ScreenshotRuntimeProofValidationTarget, context: z.RefinementCtx): void => {
  validatePrepareAiInputScaleMapping(value, context);
  validateCaptureRegionScaleMapping(value, context);
  validateOptimizeLosslessProof(value, context);
  validatePrepareVisualMissionProof(value, context);
};

export const validateScreenshotRuntimeProofCore = (value: ScreenshotRuntimeProofValidationTarget, context: z.RefinementCtx): void => {
  validateScreenshotRuntimeProofChain(value, context);
  validateScreenshotRuntimeProofTiming(value, context);
  validateScreenshotRuntimeProofSuccessArtifacts(value, context);
  validateScreenshotRuntimeProofSuccessOutputRef(value, context);
  validateScreenshotRuntimeProofFailureExposure(value, context);
};

const validateResultChainFields = (value: ScreenshotAbilityResultValidationTarget, context: z.RefinementCtx): void => {
  const invalidInputFailure = value.failureReason?.code === "input_schema_invalid";
  const resultRecord = value as Record<string, unknown>;
  const proofRecord = value.runtimeProof as Record<string, unknown>;

  if (!invalidInputFailure) {
    validateRequiredChainFields(resultRecord, SCREENSHOT_RESULT_REQUIRED_CHAIN_FIELD_NAMES, "result", context);
  }

  for (const fieldName of SCREENSHOT_RESULT_CHAIN_FIELD_NAMES) {
    if (resultRecord[fieldName] !== proofRecord[fieldName]) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `runtimeProof.${fieldName} must equal result.${fieldName}`, path: ["runtimeProof", fieldName] });
    }
  }
};

const validateResultParity = (value: ScreenshotAbilityResultValidationTarget, context: z.RefinementCtx): void => {
  if (value.runtimeProof.status !== value.status) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "runtimeProof.status must equal result.status", path: ["runtimeProof", "status"] });
  }
  if (JSON.stringify(value.dataQualityFlags) !== JSON.stringify(value.runtimeProof.dataQualityFlags)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "runtimeProof.dataQualityFlags must equal result.dataQualityFlags", path: ["runtimeProof", "dataQualityFlags"] });
  }
};

const validateResultOutputPresence = (value: ScreenshotAbilityResultValidationTarget, context: z.RefinementCtx): void => {
  if (value.status === "success" && !value.output) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "success result requires output", path: ["output"] });
  }
  if (value.status !== "success" && value.output) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "non-success result must not expose output", path: ["output"] });
  }
};

const validateVisualMissionResultOutput = (value: ScreenshotAbilityResultValidationTarget, context: z.RefinementCtx): void => {
  if (value.status !== "success" || value.childCapabilityId !== "prepare-visual-mission-input") {
    return;
  }

  const output = value.output as Record<string, unknown> | null;
  if (!output || output.gridSpecRef == null || output.visualMissionInputRef == null || output.originalScreenshotRef == null || output.coordinateGridScreenshotRef == null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "prepare-visual-mission-input result requires originalScreenshotRef, coordinateGridScreenshotRef, gridSpecRef, and visualMissionInputRef", path: ["output"] });
  }
};

const validateResultOutput = (value: ScreenshotAbilityResultValidationTarget, context: z.RefinementCtx): void => {
  validateResultOutputPresence(value, context);
  validateVisualMissionResultOutput(value, context);
};

export const validateScreenshotResult = (value: ScreenshotAbilityResultValidationTarget, context: z.RefinementCtx): void => {
  validateResultChainFields(value, context);
  validateResultParity(value, context);
  validateResultOutput(value, context);
};
