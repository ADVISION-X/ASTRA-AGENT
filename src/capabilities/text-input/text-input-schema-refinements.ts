import { z } from "zod";

import { buildStableTextInputRef } from "./shared/text-input-types.js";

const TEXT_INPUT_WRITE_CHILD_CAPABILITY_IDS = new Set(["type-text", "paste-text", "replace-input"]);
const SUCCESS_PROOF_CHAIN_FIELDS = [
  "missionId",
  "runId",
  "stepId",
  "mapPackageId",
  "mapPackageVersion",
  "selectedMapId",
  "selectedMapVersion",
  "activationId",
  "activationSnapshotRef",
  "capabilityCallId",
  "nerveBusEnvelopeId",
  "sourceRef",
  "idempotencyKey",
  "inputTargetRef",
] as const;
const RESULT_PROOF_PARITY_FIELDS = [
  "missionId",
  "runId",
  "stepId",
  "mapPackageId",
  "mapPackageVersion",
  "selectedMapId",
  "selectedMapVersion",
  "activationId",
  "activationSnapshotRef",
  "capabilityCallId",
  "nerveBusEnvelopeId",
  "sourceRef",
] as const;

type SuccessProofChainField = (typeof SUCCESS_PROOF_CHAIN_FIELDS)[number];
type ResultProofParityField = (typeof RESULT_PROOF_PARITY_FIELDS)[number];

type RuntimeProofValidationValue = {
  attemptRef: string;
  missionId: string | null;
  runId: string | null;
  stepId: string | null;
  mapPackageId: string | null;
  mapPackageVersion: string | null;
  selectedMapId: string | null;
  selectedMapVersion: string | null;
  activationId: string | null;
  activationSnapshotRef: string | null;
  capabilityCallId: string | null;
  nerveBusEnvelopeId: string | null;
  sourceRef: string | null;
  idempotencyKey: string | null;
  inputTargetRef: string | null;
  outputRef: string | null;
  actionExecutionRef: string | null;
  primitiveExecutionRef: string | null;
  postClickObservationRef: string | null;
  actionKind: string | null;
  targetKind: string | null;
  approvedTextSourceRef: string | null;
  approvedTextApprovalRef: string | null;
  diagnosticPayloadRef: string | null;
  startedAt: string;
  endedAt: string;
  status: string;
};

type AbilityResultValidationValue = {
  missionId: string | null;
  runId: string | null;
  stepId: string | null;
  mapPackageId: string | null;
  mapPackageVersion: string | null;
  selectedMapId: string | null;
  selectedMapVersion: string | null;
  activationId: string | null;
  activationSnapshotRef: string | null;
  capabilityCallId: string | null;
  nerveBusEnvelopeId: string | null;
  sourceRef: string | null;
  status: string;
  attemptRef: string;
  output: unknown | null;
  diagnosticPayloadRef: string | null;
  runtimeProof: RuntimeProofValidationValue;
};

function addMissingRuntimeProofFieldIssue(
  value: RuntimeProofValidationValue,
  context: z.RefinementCtx,
  field: SuccessProofChainField,
): void {
  if (value[field] === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: `${field} is required for successful runtime proof`, path: [field] });
  }
}

function addResultRuntimeProofParityIssue(
  value: AbilityResultValidationValue,
  context: z.RefinementCtx,
  field: ResultProofParityField,
): void {
  if (value[field] !== value.runtimeProof[field]) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: `runtimeProof.${field} must equal result.${field}`, path: ["runtimeProof", field] });
  }
}

function validateSuccessRuntimeProofCore(value: RuntimeProofValidationValue, context: z.RefinementCtx): void {
  if (value.outputRef === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "success proof requires outputRef", path: ["outputRef"] });
  }
  if (value.actionExecutionRef === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "success proof requires actionExecutionRef", path: ["actionExecutionRef"] });
  }
  if (value.primitiveExecutionRef === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "success proof requires primitiveExecutionRef", path: ["primitiveExecutionRef"] });
  }
  if (value.actionKind === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "success proof requires actionKind", path: ["actionKind"] });
  }
  if (value.targetKind === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "success proof requires targetKind", path: ["targetKind"] });
  }
}

function validateSuccessRuntimeProofWriteChildRequirements(value: RuntimeProofValidationValue, context: z.RefinementCtx): void {
  if (value.runId === buildStableTextInputRef("text-input-run", [value.attemptRef])) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "runtime proof runId must come from input, not attemptRef", path: ["runId"] });
  }

  if (value.actionKind !== null && TEXT_INPUT_WRITE_CHILD_CAPABILITY_IDS.has(value.actionKind)) {
    if (value.approvedTextSourceRef === null) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "success proof requires approvedTextSourceRef for write children", path: ["approvedTextSourceRef"] });
    }
    if (value.approvedTextApprovalRef === null) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "success proof requires approvedTextApprovalRef for write children", path: ["approvedTextApprovalRef"] });
    }
  }
}

export function validateTextInputRuntimeProofChronology(value: RuntimeProofValidationValue, context: z.RefinementCtx): void {
  if (value.startedAt > value.endedAt) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "startedAt must not be after endedAt", path: ["startedAt"] });
  }
}

export function validateTextInputRuntimeProofSuccessRequirements(value: RuntimeProofValidationValue, context: z.RefinementCtx): void {
  if (value.status !== "success") {
    return;
  }

  for (const field of SUCCESS_PROOF_CHAIN_FIELDS) {
    addMissingRuntimeProofFieldIssue(value, context, field);
  }

  validateSuccessRuntimeProofCore(value, context);
  validateSuccessRuntimeProofWriteChildRequirements(value, context);
}

export function validateTextInputRuntimeProofFailureRequirements(value: RuntimeProofValidationValue, context: z.RefinementCtx): void {
  if (value.status === "success") {
    return;
  }

  if (value.outputRef !== null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "failed and review_required require outputRef=null", path: ["outputRef"] });
  }
  if (value.diagnosticPayloadRef === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "failed and review_required require diagnosticPayloadRef", path: ["diagnosticPayloadRef"] });
  }
}

export function validateTextInputAbilityResultOutputRequirements(value: AbilityResultValidationValue, context: z.RefinementCtx): void {
  if (value.status === "success" && value.output === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "success requires output", path: ["output"] });
  }
  if (value.status !== "success" && value.output !== null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "failed and review_required require output=null", path: ["output"] });
  }
  if (value.status !== "success" && value.diagnosticPayloadRef === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "failed and review_required require diagnosticPayloadRef", path: ["diagnosticPayloadRef"] });
  }
}

export function validateTextInputAbilityResultRuntimeProofRequirements(value: AbilityResultValidationValue, context: z.RefinementCtx): void {
  for (const field of RESULT_PROOF_PARITY_FIELDS) {
    addResultRuntimeProofParityIssue(value, context, field);
  }
  if (value.runtimeProof.status !== value.status) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "runtimeProof.status must equal result.status", path: ["runtimeProof", "status"] });
  }
  if (value.runtimeProof.attemptRef !== value.attemptRef) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "runtimeProof.attemptRef must equal result.attemptRef", path: ["runtimeProof", "attemptRef"] });
  }
  if (value.runtimeProof.diagnosticPayloadRef !== value.diagnosticPayloadRef) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "runtimeProof.diagnosticPayloadRef must equal result.diagnosticPayloadRef", path: ["runtimeProof", "diagnosticPayloadRef"] });
  }
}
