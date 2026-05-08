import { z } from "zod";

type NullableString = string | null;
type MouseClickPointValue = { x: number; y: number };

type MouseClickInputBindingsValue = {
  sourceAbilityGroupId: string;
  sourceChildCapabilityId: NullableString;
  missionId: string;
  runId: string;
  sessionId: string;
  roundId: NullableString;
  videoVisitId: NullableString;
  stepId: string;
  mapPackageId: string;
  mapPackageVersion: string;
  selectedMapId: string;
  selectedMapVersion: string;
  activationSnapshotRef: string;
  capabilityCallId: string;
  nerveBusEnvelopeId: string;
  sourceCoordinateProofRef: string;
  sourceTargetRef: string;
  sourceVisualTargetResultRef: NullableString;
  geometryGuardRef: string;
  guardDecision: "allow";
  geometryGuardOutputRef: string;
  geometryGuardRuntimeProofRef: string;
  geometryGuardNormalizedCoordinateSpace: string;
  geometryGuardNormalizedClickPoint: MouseClickPointValue;
  geometryGuardProof: {
    sourceAbilityGroupId: string; sourceChildCapabilityId: NullableString; missionId: string; runId: string; sessionId: string; roundId: NullableString;
    videoVisitId: NullableString; stepId: string; mapPackageId: string; mapPackageVersion: string; selectedMapId: string; selectedMapVersion: string;
    activationSnapshotRef: string; capabilityCallId: string; nerveBusEnvelopeId: string; proofId: string; sourceTargetRef: string;
    sourceVisualTargetResultRef: NullableString; geometryGuardRef: string; guardDecision: "allow"; outputRef: string; runtimeProofRef: string;
    normalizedCoordinateSpace: string; normalizedClickPoint: MouseClickPointValue;
  };
};

type MouseClickRuntimeProofValue = {
  status: string; startedAt: string; endedAt: string; retryCount: number; maxRetry: number;
  actionExecutionRef: NullableString; primitiveExecutionRef: NullableString; executableCoordinate: MouseClickPointValue | null;
  postClickObservation: boolean; postClickObservationRef: NullableString; missionId: NullableString; runId: NullableString;
  stepId: NullableString; mapPackageId: NullableString; mapPackageVersion: NullableString; selectedMapId: NullableString; selectedMapVersion: NullableString;
  activationSnapshotRef: NullableString; capabilityCallId: NullableString; nerveBusEnvelopeId: NullableString; geometryGuardProofRef: NullableString;
  geometryGuardOutputRef: NullableString; geometryGuardRuntimeProofRef: NullableString; diagnosticPayloadRef: NullableString; attemptRef: string;
  sourceVisualTargetResultRef: NullableString; geometryDecision: string; safetyDecision: string; primitiveDecision: string;
  timeoutDecision: string; abortDecision: string; idempotencyDecision: NullableString;
};

type MouseClickAbilityResultValue = {
  status: string; output: { postClickObservation: boolean; postClickObservationRef: NullableString } | null; attemptRef: string; missionId: NullableString; runId: NullableString;
  stepId: NullableString; mapPackageId: NullableString; mapPackageVersion: NullableString; selectedMapId: NullableString; selectedMapVersion: NullableString;
  activationSnapshotRef: NullableString; capabilityCallId: NullableString; nerveBusEnvelopeId: NullableString; diagnosticPayloadRef: NullableString;
  geometryGuardProofRef: NullableString; sourceVisualTargetResultRef: NullableString; geometryDecision: string; safetyDecision: string;
  primitiveDecision: string; timeoutDecision: string; abortDecision: string; idempotencyDecision: NullableString; postClickObservationRef: NullableString;
  runtimeProof: MouseClickRuntimeProofValue;
};

const addIssue = (context: z.RefinementCtx, message: string, path: (string | number)[]): void => {
  context.addIssue({ code: z.ZodIssueCode.custom, message, path });
};

const validateBinding = (context: z.RefinementCtx, matches: boolean, path: (string | number)[], message: string): void => {
  if (!matches) {
    addIssue(context, message, path);
  }
};

const validateInputSourceBindings = (value: MouseClickInputBindingsValue, context: z.RefinementCtx): void => {
  const proof = value.geometryGuardProof;
  validateBinding(context, value.sourceAbilityGroupId === proof.sourceAbilityGroupId, ["sourceAbilityGroupId"], "sourceAbilityGroupId must match geometryGuardProof.sourceAbilityGroupId");
  validateBinding(context, value.sourceChildCapabilityId === proof.sourceChildCapabilityId, ["sourceChildCapabilityId"], "sourceChildCapabilityId must match geometryGuardProof.sourceChildCapabilityId");
  validateBinding(context, value.missionId === proof.missionId, ["missionId"], "missionId must match geometryGuardProof.missionId");
  validateBinding(context, value.runId === proof.runId, ["runId"], "runId must match geometryGuardProof.runId");
  validateBinding(context, value.sessionId === proof.sessionId, ["sessionId"], "sessionId must match geometryGuardProof.sessionId");
  validateBinding(context, value.roundId === proof.roundId, ["roundId"], "roundId must match geometryGuardProof.roundId");
  validateBinding(context, value.videoVisitId === proof.videoVisitId, ["videoVisitId"], "videoVisitId must match geometryGuardProof.videoVisitId");
};

const validateInputExecutionBindings = (value: MouseClickInputBindingsValue, context: z.RefinementCtx): void => {
  const proof = value.geometryGuardProof;
  validateBinding(context, value.stepId === proof.stepId, ["stepId"], "stepId must match geometryGuardProof.stepId");
  validateBinding(context, value.mapPackageId === proof.mapPackageId, ["mapPackageId"], "mapPackageId must match geometryGuardProof.mapPackageId");
  validateBinding(context, value.mapPackageVersion === proof.mapPackageVersion, ["mapPackageVersion"], "mapPackageVersion must match geometryGuardProof.mapPackageVersion");
  validateBinding(context, value.selectedMapId === proof.selectedMapId, ["selectedMapId"], "selectedMapId must match geometryGuardProof.selectedMapId");
  validateBinding(context, value.selectedMapVersion === proof.selectedMapVersion, ["selectedMapVersion"], "selectedMapVersion must match geometryGuardProof.selectedMapVersion");
  validateBinding(context, value.activationSnapshotRef === proof.activationSnapshotRef, ["activationSnapshotRef"], "activationSnapshotRef must match geometryGuardProof.activationSnapshotRef");
  validateBinding(context, value.capabilityCallId === proof.capabilityCallId, ["capabilityCallId"], "capabilityCallId must match geometryGuardProof.capabilityCallId");
  validateBinding(context, value.nerveBusEnvelopeId === proof.nerveBusEnvelopeId, ["nerveBusEnvelopeId"], "nerveBusEnvelopeId must match geometryGuardProof.nerveBusEnvelopeId");
};

const validateInputGuardBindings = (value: MouseClickInputBindingsValue, context: z.RefinementCtx): void => {
  const proof = value.geometryGuardProof;
  validateBinding(context, value.sourceCoordinateProofRef === proof.proofId, ["sourceCoordinateProofRef"], "sourceCoordinateProofRef must match geometryGuardProof.proofId");
  validateBinding(context, value.sourceTargetRef === proof.sourceTargetRef, ["sourceTargetRef"], "sourceTargetRef must match geometryGuardProof.sourceTargetRef");
  validateBinding(context, value.sourceVisualTargetResultRef === proof.sourceVisualTargetResultRef, ["sourceVisualTargetResultRef"], "sourceVisualTargetResultRef must match geometryGuardProof.sourceVisualTargetResultRef");
  validateBinding(context, value.geometryGuardRef === proof.geometryGuardRef, ["geometryGuardRef"], "geometryGuardRef must match geometryGuardProof.geometryGuardRef");
  validateBinding(context, value.guardDecision === proof.guardDecision, ["guardDecision"], "guardDecision must match geometryGuardProof.guardDecision");
  validateBinding(context, value.geometryGuardOutputRef === proof.outputRef, ["geometryGuardOutputRef"], "geometryGuardOutputRef must match geometryGuardProof.outputRef");
  validateBinding(context, value.geometryGuardRuntimeProofRef === proof.runtimeProofRef, ["geometryGuardRuntimeProofRef"], "geometryGuardRuntimeProofRef must match geometryGuardProof.runtimeProofRef");
};

const validateInputNormalizedGeometry = (value: MouseClickInputBindingsValue, context: z.RefinementCtx): void => {
  const proof = value.geometryGuardProof;
  validateBinding(
    context,
    value.geometryGuardNormalizedCoordinateSpace === proof.normalizedCoordinateSpace,
    ["geometryGuardNormalizedCoordinateSpace"],
    "geometryGuardNormalizedCoordinateSpace must match geometryGuardProof.normalizedCoordinateSpace",
  );
  validateBinding(
    context,
    value.geometryGuardNormalizedClickPoint.x === proof.normalizedClickPoint.x && value.geometryGuardNormalizedClickPoint.y === proof.normalizedClickPoint.y,
    ["geometryGuardNormalizedClickPoint"],
    "geometryGuardNormalizedClickPoint must match geometryGuardProof.normalizedClickPoint",
  );
};

export const validateMouseClickInputBindings = (value: MouseClickInputBindingsValue, context: z.RefinementCtx): void => {
  validateInputSourceBindings(value, context);
  validateInputExecutionBindings(value, context);
  validateInputGuardBindings(value, context);
  validateInputNormalizedGeometry(value, context);
};

const validateSuccessOutcomeRefs = (value: MouseClickRuntimeProofValue, context: z.RefinementCtx): void => {
  validateBinding(context, value.actionExecutionRef !== null, ["actionExecutionRef"], "success proof requires actionExecutionRef");
  validateBinding(context, value.primitiveExecutionRef !== null, ["primitiveExecutionRef"], "success proof requires primitiveExecutionRef");
  validateBinding(context, value.executableCoordinate !== null, ["executableCoordinate"], "success proof requires executableCoordinate");
};

const validateSuccessChainFields = (value: MouseClickRuntimeProofValue, context: z.RefinementCtx): void => {
  validateBinding(context, value.missionId !== null && value.runId !== null && value.stepId !== null, ["missionId"], "success proof requires missionId, runId, and stepId");
  validateBinding(
    context,
    value.mapPackageId !== null && value.mapPackageVersion !== null && value.selectedMapId !== null && value.selectedMapVersion !== null,
    ["mapPackageId"],
    "success proof requires mapPackageId/mapPackageVersion/selectedMapId/selectedMapVersion",
  );
  validateBinding(
    context,
    value.activationSnapshotRef !== null && value.capabilityCallId !== null && value.nerveBusEnvelopeId !== null,
    ["activationSnapshotRef"],
    "success proof requires activationSnapshotRef, capabilityCallId, and nerveBusEnvelopeId",
  );
};

const validateSuccessGuardChain = (value: MouseClickRuntimeProofValue, context: z.RefinementCtx): void => {
  validateBinding(
    context,
    value.geometryGuardProofRef !== null && value.geometryGuardOutputRef !== null && value.geometryGuardRuntimeProofRef !== null,
    ["geometryGuardProofRef"],
    "success proof requires full Geometry Guard proof chain",
  );
};

const validateNonSuccessRuntimeProof = (value: MouseClickRuntimeProofValue, context: z.RefinementCtx): void => {
  validateBinding(context, value.diagnosticPayloadRef !== null, ["diagnosticPayloadRef"], "non-success proof requires diagnosticPayloadRef");
  validateBinding(context, value.executableCoordinate === null, ["executableCoordinate"], "non-success proof must not expose executableCoordinate");
};

export const validateMouseClickRuntimeProof = (value: MouseClickRuntimeProofValue, context: z.RefinementCtx): void => {
  validateBinding(context, value.startedAt <= value.endedAt, ["startedAt"], "startedAt must not be after endedAt");
  validateBinding(context, value.retryCount === 0, ["retryCount"], "retryCount must stay 0 for every Mouse Click attempt");
  validateBinding(context, value.maxRetry === 0, ["maxRetry"], "maxRetry must stay 0 for every Mouse Click attempt");
  if (value.status === "success") {
    validateSuccessOutcomeRefs(value, context);
    validateSuccessChainFields(value, context);
    validateSuccessGuardChain(value, context);
    return;
  }

  validateNonSuccessRuntimeProof(value, context);
};

const validateAbilityResultCore = (value: MouseClickAbilityResultValue, context: z.RefinementCtx): void => {
  validateBinding(context, value.status !== "success" || value.output !== null, ["output"], "success requires output");
  validateBinding(context, value.status === "success" || value.output === null, ["output"], "failed and review_required require output=null");
  validateBinding(context, value.runtimeProof.status === value.status, ["runtimeProof", "status"], "runtimeProof.status must equal result.status");
  validateBinding(context, value.runtimeProof.attemptRef === value.attemptRef, ["runtimeProof", "attemptRef"], "runtimeProof.attemptRef must equal result.attemptRef");
};

const validateAbilityResultChainParity = (value: MouseClickAbilityResultValue, context: z.RefinementCtx): void => {
  validateBinding(context, value.missionId === value.runtimeProof.missionId, ["runtimeProof", "missionId"], "runtimeProof.missionId must equal result.missionId");
  validateBinding(context, value.runId === value.runtimeProof.runId, ["runtimeProof", "runId"], "runtimeProof.runId must equal result.runId");
  validateBinding(context, value.stepId === value.runtimeProof.stepId, ["runtimeProof", "stepId"], "runtimeProof.stepId must equal result.stepId");
  validateBinding(context, value.mapPackageId === value.runtimeProof.mapPackageId, ["runtimeProof", "mapPackageId"], "runtimeProof.mapPackageId must equal result.mapPackageId");
  validateBinding(context, value.mapPackageVersion === value.runtimeProof.mapPackageVersion, ["runtimeProof", "mapPackageVersion"], "runtimeProof.mapPackageVersion must equal result.mapPackageVersion");
  validateBinding(context, value.selectedMapId === value.runtimeProof.selectedMapId, ["runtimeProof", "selectedMapId"], "runtimeProof.selectedMapId must equal result.selectedMapId");
  validateBinding(context, value.selectedMapVersion === value.runtimeProof.selectedMapVersion, ["runtimeProof", "selectedMapVersion"], "runtimeProof.selectedMapVersion must equal result.selectedMapVersion");
  validateBinding(context, value.activationSnapshotRef === value.runtimeProof.activationSnapshotRef, ["runtimeProof", "activationSnapshotRef"], "runtimeProof.activationSnapshotRef must equal result.activationSnapshotRef");
  validateBinding(context, value.capabilityCallId === value.runtimeProof.capabilityCallId, ["runtimeProof", "capabilityCallId"], "runtimeProof.capabilityCallId must equal result.capabilityCallId");
  validateBinding(context, value.nerveBusEnvelopeId === value.runtimeProof.nerveBusEnvelopeId, ["runtimeProof", "nerveBusEnvelopeId"], "runtimeProof.nerveBusEnvelopeId must equal result.nerveBusEnvelopeId");
};

const validateAbilityResultDecisionParity = (value: MouseClickAbilityResultValue, context: z.RefinementCtx): void => {
  validateBinding(context, value.diagnosticPayloadRef === value.runtimeProof.diagnosticPayloadRef, ["runtimeProof", "diagnosticPayloadRef"], "runtimeProof.diagnosticPayloadRef must equal result.diagnosticPayloadRef");
  validateBinding(context, value.geometryGuardProofRef === value.runtimeProof.geometryGuardProofRef, ["runtimeProof", "geometryGuardProofRef"], "runtimeProof.geometryGuardProofRef must equal result.geometryGuardProofRef");
  validateBinding(context, value.sourceVisualTargetResultRef === value.runtimeProof.sourceVisualTargetResultRef, ["runtimeProof", "sourceVisualTargetResultRef"], "runtimeProof.sourceVisualTargetResultRef must equal result.sourceVisualTargetResultRef");
  validateBinding(context, value.geometryDecision === value.runtimeProof.geometryDecision, ["runtimeProof", "geometryDecision"], "runtimeProof.geometryDecision must equal result.geometryDecision");
  validateBinding(context, value.safetyDecision === value.runtimeProof.safetyDecision, ["runtimeProof", "safetyDecision"], "runtimeProof.safetyDecision must equal result.safetyDecision");
  validateBinding(context, value.primitiveDecision === value.runtimeProof.primitiveDecision, ["runtimeProof", "primitiveDecision"], "runtimeProof.primitiveDecision must equal result.primitiveDecision");
  validateBinding(context, value.timeoutDecision === value.runtimeProof.timeoutDecision, ["runtimeProof", "timeoutDecision"], "runtimeProof.timeoutDecision must equal result.timeoutDecision");
  validateBinding(context, value.abortDecision === value.runtimeProof.abortDecision, ["runtimeProof", "abortDecision"], "runtimeProof.abortDecision must equal result.abortDecision");
  validateBinding(context, value.idempotencyDecision === value.runtimeProof.idempotencyDecision, ["runtimeProof", "idempotencyDecision"], "runtimeProof.idempotencyDecision must equal result.idempotencyDecision");
  validateBinding(context, value.postClickObservationRef === value.runtimeProof.postClickObservationRef, ["runtimeProof", "postClickObservationRef"], "runtimeProof.postClickObservationRef must equal result.postClickObservationRef");
};

const validateAbilityResultOutput = (value: MouseClickAbilityResultValue, context: z.RefinementCtx): void => {
  validateBinding(
    context,
    !value.output || value.output.postClickObservationRef === value.postClickObservationRef,
    ["output", "postClickObservationRef"],
    "output.postClickObservationRef must equal result.postClickObservationRef",
  );
};

export const validateMouseClickAbilityResult = (value: MouseClickAbilityResultValue, context: z.RefinementCtx): void => {
  validateAbilityResultCore(value, context);
  validateAbilityResultChainParity(value, context);
  validateAbilityResultDecisionParity(value, context);
  validateAbilityResultOutput(value, context);
};
