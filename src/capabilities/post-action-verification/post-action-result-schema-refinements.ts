import { z } from "zod";

type NullableString = string | null;
type PackageStatus = "built" | "failed" | "review_required";
type RuntimeProofChainField =
  | "missionId"
  | "runId"
  | "sessionId"
  | "roundId"
  | "videoVisitId"
  | "stepId"
  | "bindingPackageId"
  | "bindingPackageVersion"
  | "selectedBindingId"
  | "bindingVersion"
  | "bindingSnapshotRef"
  | "capabilityCallId"
  | "nerveBusEnvelopeId";

type PostActionVerificationAbilityResultValue = {
  status: string;
  childCapabilityId: NullableString;
  missionId: NullableString;
  runId: NullableString;
  sessionId: NullableString;
  roundId: NullableString;
  videoVisitId: NullableString;
  stepId: NullableString;
  bindingPackageId: NullableString;
  bindingPackageVersion: NullableString;
  selectedBindingId: NullableString;
  bindingVersion: NullableString;
  bindingSnapshotRef: NullableString;
  capabilityCallId: NullableString;
  nerveBusEnvelopeId: NullableString;
  postActionVerificationResultRef: NullableString;
  actionProofRef: NullableString;
  expectedOutcome: unknown | null;
  output: {
    observationRefs: string[];
    supportingSourceProofRefs: string[];
    observationFingerprint: string;
  } | null;
  failureReason: string | null;
  reviewRequiredReason: string | null;
  diagnosticPayloadRef: NullableString;
  observationRefs: string[];
  supportingSourceProofRefs: string[];
  observationFingerprint: NullableString;
  packageStatus: PackageStatus;
  runtimeProof: Record<RuntimeProofChainField, NullableString> & {
    status: string;
    outputRef: NullableString;
  };
};

const RESULT_RUNTIME_PROOF_CHAIN_FIELDS: RuntimeProofChainField[] = [
  "missionId",
  "runId",
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
];

const OPTIONAL_GOVERNED_RESULT_CHAIN_FIELDS = new Set<RuntimeProofChainField>([
  "roundId",
  "videoVisitId",
]);

const addIssue = (context: z.RefinementCtx, message: string, path: (string | number)[]) => {
  context.addIssue({ code: z.ZodIssueCode.custom, message, path });
};

const validateRuntimeProofChain = (
  value: PostActionVerificationAbilityResultValue,
  context: z.RefinementCtx,
) => {
  for (const field of RESULT_RUNTIME_PROOF_CHAIN_FIELDS) {
    if (value.runtimeProof[field] !== value[field]) {
      addIssue(context, `runtimeProof.${field} must equal result.${field}`, ["runtimeProof", field]);
    }
  }
  if (value.runtimeProof.status !== value.status) {
    addIssue(context, "runtimeProof.status must equal result.status", ["runtimeProof", "status"]);
  }
  if (value.postActionVerificationResultRef !== value.runtimeProof.outputRef) {
    addIssue(context, "postActionVerificationResultRef must equal runtimeProof.outputRef", ["postActionVerificationResultRef"]);
  }
};

const validateSuccessfulShape = (
  value: PostActionVerificationAbilityResultValue,
  context: z.RefinementCtx,
) => {
  if (value.output === null) {
    addIssue(context, "success result requires output", ["output"]);
  }
  if (value.diagnosticPayloadRef !== null) {
    addIssue(context, "success result must not expose diagnosticPayloadRef", ["diagnosticPayloadRef"]);
  }
  if (value.output !== null && value.output.supportingSourceProofRefs.length === 0) {
    addIssue(context, "success output requires supportingSourceProofRefs", ["output", "supportingSourceProofRefs"]);
  }
  if (value.postActionVerificationResultRef === null) {
    addIssue(context, "success result requires postActionVerificationResultRef", ["postActionVerificationResultRef"]);
  }
  if (value.packageStatus !== "built") {
    addIssue(context, "success result must keep packageStatus=built", ["packageStatus"]);
  }
};

const validateUnsuccessfulEnvelope = (
  value: PostActionVerificationAbilityResultValue,
  context: z.RefinementCtx,
) => {
  if (value.output !== null) {
    addIssue(context, "failed/review_required result must not expose output", ["output"]);
  }
  if (value.diagnosticPayloadRef === null) {
    addIssue(context, "failed/review_required result requires diagnosticPayloadRef", ["diagnosticPayloadRef"]);
  }
};

const validateUnsuccessfulOutcomeReasons = (
  value: PostActionVerificationAbilityResultValue,
  context: z.RefinementCtx,
) => {
  if (value.status === "failed" && value.failureReason === null) {
    addIssue(context, "failed result requires failureReason", ["failureReason"]);
  }
  if (value.status === "review_required" && value.reviewRequiredReason === null) {
    addIssue(context, "review_required result requires reviewRequiredReason", ["reviewRequiredReason"]);
  }
};

const validateUnsuccessfulPackageStatus = (
  value: PostActionVerificationAbilityResultValue,
  context: z.RefinementCtx,
) => {
  if (value.status === "failed" && value.packageStatus !== "failed") {
    addIssue(context, "failed result must keep packageStatus=failed", ["packageStatus"]);
  }
  if (value.status === "review_required" && value.packageStatus !== "review_required") {
    addIssue(context, "review_required result must keep packageStatus=review_required", ["packageStatus"]);
  }
};

const validateUnsuccessfulShape = (
  value: PostActionVerificationAbilityResultValue,
  context: z.RefinementCtx,
) => {
  validateUnsuccessfulEnvelope(value, context);
  validateUnsuccessfulOutcomeReasons(value, context);
  validateUnsuccessfulPackageStatus(value, context);
};

const validateOutputParity = (
  value: PostActionVerificationAbilityResultValue,
  context: z.RefinementCtx,
) => {
  if (value.output === null) {
    return;
  }
  if (value.output.observationRefs.length !== value.observationRefs.length) {
    addIssue(context, "output.observationRefs must equal result.observationRefs", ["output", "observationRefs"]);
  }
  if (value.output.supportingSourceProofRefs.length !== value.supportingSourceProofRefs.length) {
    addIssue(context, "output.supportingSourceProofRefs must equal result.supportingSourceProofRefs", ["output", "supportingSourceProofRefs"]);
  }
  if (value.output.observationFingerprint !== value.observationFingerprint) {
    addIssue(context, "output.observationFingerprint must equal result.observationFingerprint", ["output", "observationFingerprint"]);
  }
};

const validateGovernedFields = (
  value: PostActionVerificationAbilityResultValue,
  context: z.RefinementCtx,
) => {
  if (value.failureReason === "input_schema_invalid") {
    return;
  }
  if (value.childCapabilityId === null) {
    addIssue(context, "childCapabilityId is required for governed results", ["childCapabilityId"]);
  }
  for (const field of RESULT_RUNTIME_PROOF_CHAIN_FIELDS) {
    if (!OPTIONAL_GOVERNED_RESULT_CHAIN_FIELDS.has(field) && value[field] === null) {
      addIssue(context, `${field} is required for governed results`, [field]);
    }
  }
  if (value.expectedOutcome === null) {
    addIssue(context, "expectedOutcome is required for governed results", ["expectedOutcome"]);
  }
  if (value.actionProofRef === null) {
    addIssue(context, "actionProofRef is required for governed results", ["actionProofRef"]);
  }
};

export const validatePostActionVerificationAbilityResult = (
  value: PostActionVerificationAbilityResultValue,
  context: z.RefinementCtx,
) => {
  validateRuntimeProofChain(value, context);
  if (value.status === "success") {
    validateSuccessfulShape(value, context);
  } else {
    validateUnsuccessfulShape(value, context);
  }
  validateGovernedFields(value, context);
  validateOutputParity(value, context);
};