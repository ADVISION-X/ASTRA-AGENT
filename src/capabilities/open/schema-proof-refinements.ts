import { z } from "zod";

type OpenExecutionChainField =
  | "missionId"
  | "runId"
  | "sessionId"
  | "stepId"
  | "mapPackageId"
  | "mapPackageVersion"
  | "selectedMapId"
  | "selectedMapVersion"
  | "activationSnapshotRef"
  | "capabilityCallId"
  | "nerveBusEnvelopeId";

type DataQualityFlag = { code: string; reason: string; severity: string };

type OpenRuntimeProofValidationValue = {
  failureInputParseDecision: string;
  missionId: string | null;
  runId: string | null;
  sessionId: string | null;
  stepId: string | null;
  mapPackageId: string | null;
  mapPackageVersion: string | null;
  selectedMapId: string | null;
  selectedMapVersion: string | null;
  activationSnapshotRef: string | null;
  capabilityCallId: string | null;
  nerveBusEnvelopeId: string | null;
  browserSessionRef: string | null;
  targetKind: string | null;
  diagnosticPayloadRef: string | null;
  receivedShapeHash: string | null;
  dataQualityFlags: DataQualityFlag[];
  clock: { startedMonotonicMs: number; endedMonotonicMs: number };
  status: string;
  postOpenDecision: { status: string };
  outputRef: string | null;
  pageStateHandoffRequired: boolean;
  pageStateHandoffRef: string | null;
  windowHandoffRef: string | null;
  localAppStateHandoffRef: string | null;
};

type OpenResultValidationValue = {
  status: string;
  missionId: string | null;
  runId: string | null;
  sessionId: string | null;
  stepId: string | null;
  mapPackageId: string | null;
  mapPackageVersion: string | null;
  selectedMapId: string | null;
  selectedMapVersion: string | null;
  activationSnapshotRef: string | null;
  capabilityCallId: string | null;
  nerveBusEnvelopeId: string | null;
  output: unknown | null;
  diagnosticPayloadRef: string | null;
  pageStateHandoffRequired: boolean;
  dataQualityFlags: DataQualityFlag[];
  runtimeProof: OpenRuntimeProofValidationValue;
};

const OPEN_EXECUTION_CHAIN_FIELDS: readonly OpenExecutionChainField[] = [
  "missionId",
  "runId",
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

const addIssue = (context: z.RefinementCtx, path: string[], message: string): void => {
  context.addIssue({ code: z.ZodIssueCode.custom, message, path });
};

const arraysMatch = <TValue>(left: readonly TValue[], right: readonly TValue[], matcher: (leftValue: TValue, rightValue: TValue) => boolean): boolean => {
  return left.length === right.length && left.every((value, index) => matcher(value, right[index]!));
};

const validateExecutionChainFields = (
  value: Pick<OpenRuntimeProofValidationValue, OpenExecutionChainField>,
  context: z.RefinementCtx,
  messagePrefix: string,
): void => {
  for (const field of OPEN_EXECUTION_CHAIN_FIELDS) {
    if (!value[field]) {
      addIssue(context, [field], `${messagePrefix} requires ${field}`);
    }
  }
};

const validateParsedRuntimeProof = (value: OpenRuntimeProofValidationValue, context: z.RefinementCtx): void => {
  validateExecutionChainFields(value, context, "parsed runtime proof");
  if (value.targetKind !== "local-program" && !value.browserSessionRef) {
    addIssue(context, ["browserSessionRef"], "parsed runtime proof requires browserSessionRef");
  }
  if (value.receivedShapeHash !== null) {
    addIssue(context, ["receivedShapeHash"], "parsed runtime proof must not carry receivedShapeHash");
  }
};

const validateFallbackRuntimeProof = (value: OpenRuntimeProofValidationValue, context: z.RefinementCtx): void => {
  if (value.receivedShapeHash === null) {
    addIssue(context, ["receivedShapeHash"], "fallback_trace_only runtime proof requires receivedShapeHash");
  }
};

const validateOpenRuntimeProofTiming = (value: OpenRuntimeProofValidationValue, context: z.RefinementCtx): void => {
  if (value.clock.startedMonotonicMs > value.clock.endedMonotonicMs) {
    addIssue(context, ["clock", "startedMonotonicMs"], "startedMonotonicMs must not be after endedMonotonicMs");
  }
};

const validateOpenRuntimeProofChain = (value: OpenRuntimeProofValidationValue, context: z.RefinementCtx): void => {
  if (value.failureInputParseDecision === "parsed") {
    validateParsedRuntimeProof(value, context);
    return;
  }

  validateFallbackRuntimeProof(value, context);
};

const validateOpenRuntimeProofStatus = (value: OpenRuntimeProofValidationValue, context: z.RefinementCtx): void => {
  if (value.status !== value.postOpenDecision.status) {
    addIssue(context, ["postOpenDecision", "status"], "proof status must equal postOpenDecision.status");
  }
};

const validateSuccessRuntimeProof = (value: OpenRuntimeProofValidationValue, context: z.RefinementCtx): void => {
  if (value.outputRef === null) {
    addIssue(context, ["outputRef"], "success proof requires outputRef");
  }
  if (!value.pageStateHandoffRequired || value.pageStateHandoffRef === null) {
    addIssue(context, ["pageStateHandoffRef"], "success proof requires page-state handoff");
  }
  if (value.targetKind === "local-program" && value.windowHandoffRef === null) {
    addIssue(context, ["windowHandoffRef"], "local program success proof requires windowHandoffRef");
  }
  if (value.targetKind === "local-program" && value.localAppStateHandoffRef === null) {
    addIssue(context, ["localAppStateHandoffRef"], "local program success proof requires localAppStateHandoffRef");
  }
  if (value.diagnosticPayloadRef !== null) {
    addIssue(context, ["diagnosticPayloadRef"], "success proof must not expose diagnosticPayloadRef");
  }
  if (value.dataQualityFlags.some((flag) => flag.severity === "error")) {
    addIssue(context, ["dataQualityFlags"], "success proof must not retain error-severity data-quality flags");
  }
};

const validateNonSuccessRuntimeProof = (value: OpenRuntimeProofValidationValue, context: z.RefinementCtx): void => {
  if (value.outputRef !== null) {
    addIssue(context, ["outputRef"], "failed and review_required proof must not expose outputRef");
  }
  if (value.diagnosticPayloadRef === null) {
    addIssue(context, ["diagnosticPayloadRef"], "failed and review_required proof must expose diagnosticPayloadRef");
  }
};

export const validateOpenRuntimeProof = (value: unknown, context: z.RefinementCtx): void => {
  const proof = value as OpenRuntimeProofValidationValue;
  validateOpenRuntimeProofTiming(proof, context);
  validateOpenRuntimeProofChain(proof, context);
  validateOpenRuntimeProofStatus(proof, context);
  if (proof.status === "success") {
    validateSuccessRuntimeProof(proof, context);
    return;
  }

  validateNonSuccessRuntimeProof(proof, context);
};

const validateRuntimeProofStatusParity = (value: OpenResultValidationValue, context: z.RefinementCtx): void => {
  if (value.runtimeProof.status !== value.status) {
    addIssue(context, ["runtimeProof", "status"], "runtimeProof.status must equal result.status");
  }
};

const validateResultExecutionChain = (value: OpenResultValidationValue, context: z.RefinementCtx): void => {
  if (value.runtimeProof.failureInputParseDecision === "parsed") {
    validateExecutionChainFields(value as Pick<OpenRuntimeProofValidationValue, OpenExecutionChainField>, context, "parsed result");
  }

  for (const field of OPEN_EXECUTION_CHAIN_FIELDS) {
    if (value[field] !== value.runtimeProof[field]) {
      addIssue(context, [field], `result ${field} must match runtimeProof.${field}`);
    }
  }
};

const validateResultParity = (value: OpenResultValidationValue, context: z.RefinementCtx): void => {
  if (value.diagnosticPayloadRef !== value.runtimeProof.diagnosticPayloadRef) {
    addIssue(context, ["diagnosticPayloadRef"], "result diagnosticPayloadRef must match runtimeProof.diagnosticPayloadRef");
  }
  if (value.pageStateHandoffRequired !== value.runtimeProof.pageStateHandoffRequired) {
    addIssue(context, ["pageStateHandoffRequired"], "result pageStateHandoffRequired must match runtimeProof.pageStateHandoffRequired");
  }
  if (!arraysMatch(value.dataQualityFlags, value.runtimeProof.dataQualityFlags, (left, right) => left.code === right.code && left.severity === right.severity && left.reason === right.reason)) {
    addIssue(context, ["dataQualityFlags"], "result dataQualityFlags must match runtimeProof.dataQualityFlags");
  }
};

const validateSuccessResult = (value: OpenResultValidationValue, context: z.RefinementCtx): void => {
  if (value.output === null) {
    addIssue(context, ["output"], "success result requires output");
  }
  if (!value.pageStateHandoffRequired) {
    addIssue(context, ["pageStateHandoffRequired"], "success result requires pageStateHandoffRequired=true");
  }
  if (value.diagnosticPayloadRef !== null) {
    addIssue(context, ["diagnosticPayloadRef"], "success result must not expose diagnosticPayloadRef");
  }
  if (value.dataQualityFlags.some((flag) => flag.severity === "error")) {
    addIssue(context, ["dataQualityFlags"], "success result must not retain error-severity data-quality flags");
  }
};

const validateNonSuccessResult = (value: OpenResultValidationValue, context: z.RefinementCtx): void => {
  if (value.output !== null) {
    addIssue(context, ["output"], "failed and review_required result must not expose output");
  }
  if (value.diagnosticPayloadRef === null) {
    addIssue(context, ["diagnosticPayloadRef"], "failed and review_required result must expose diagnosticPayloadRef");
  }
};

export const validateOpenResult = (value: unknown, context: z.RefinementCtx): void => {
  const result = value as OpenResultValidationValue;
  validateRuntimeProofStatusParity(result, context);
  validateResultExecutionChain(result, context);
  validateResultParity(result, context);
  if (result.status === "success") {
    validateSuccessResult(result, context);
    return;
  }

  validateNonSuccessResult(result, context);
};
