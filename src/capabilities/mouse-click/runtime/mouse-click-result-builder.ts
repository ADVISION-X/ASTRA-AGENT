import type { MouseClickResultSeed } from "./mouse-click-input-gate.js";
import { MouseClickAbilityResultSchema } from "../schema.js";
import { buildStableMouseClickRef } from "../shared/mouse-click-types.js";
import { buildMouseClickRuntimeProof } from "./mouse-click-proof-builder.js";

function buildVerificationState(input: Parameters<typeof buildMouseClickResult>[0], outputRef: string) {
  const postClickObservation = input.status === "success";
  const postClickObservationRef = postClickObservation && input.actionExecutionRef && input.primitiveExecutionRef
    ? buildStableMouseClickRef("mouse-click-post-click-observation", [input.actionExecutionRef, input.primitiveExecutionRef])
    : null;
  const postActionVerificationHandoffRef = postClickObservation && input.actionExecutionRef && input.primitiveExecutionRef
    ? buildStableMouseClickRef("mouse-click-post-action-verification-handoff", [outputRef, input.actionExecutionRef, input.primitiveExecutionRef])
    : null;
  return { postClickObservation, postClickObservationRef, postActionVerificationRequired: postClickObservation, postActionVerificationHandoffRef };
}

function buildSuccessOutput(
  input: Parameters<typeof buildMouseClickResult>[0],
  outputRef: string,
  verification: ReturnType<typeof buildVerificationState>,
) {
  return input.status === "success" && input.actionExecutionRef && input.primitiveExecutionRef && input.executableCoordinate
    ? {
        clickResultRef: outputRef,
        attemptRef: input.seed.attemptRef,
        actionExecutionRef: input.actionExecutionRef,
        primitiveExecutionRef: input.primitiveExecutionRef,
        geometryGuardRef: input.seed.geometryGuardRef,
        geometryGuardProofRef: input.seed.geometryGuardProofRef,
        sourceCoordinateProofRef: input.seed.sourceCoordinateProofRef,
        sourceTargetRef: input.seed.sourceTargetRef,
        sourceVisualTargetResultRef: input.seed.sourceVisualTargetResultRef,
        normalizedClickPoint: input.executableCoordinate,
        coordinateSpace: input.seed.coordinateSpace,
        button: input.seed.button,
        clickCount: input.seed.clickCount,
        postClickObservation: true as const,
        postClickObservationRef: verification.postClickObservationRef,
        postActionVerificationRequired: true as const,
        postActionVerificationHandoffRef: verification.postActionVerificationHandoffRef,
      }
    : null;
}

function buildDiagnosticPayloadRef(input: Parameters<typeof buildMouseClickResult>[0]) {
  return input.status === "success"
    ? null
    : buildStableMouseClickRef("mouse-click-diagnostic-payload", [input.seed.attemptRef, input.status, input.failureReason, input.reviewRequiredReason]);
}

function buildRuntimeProofSeed(input: Parameters<typeof buildMouseClickResult>[0], outputRef: string, diagnosticPayloadRef: string | null) {
  return {
    attemptRef: input.seed.attemptRef, childCapabilityId: input.seed.childCapabilityId, missionId: input.seed.missionId, runId: input.seed.runId,
    sessionId: input.seed.sessionId, roundId: input.seed.roundId, videoVisitId: input.seed.videoVisitId, stepId: input.seed.stepId,
    mapPackageId: input.seed.mapPackageId, mapPackageVersion: input.seed.mapPackageVersion, selectedMapId: input.seed.selectedMapId,
    selectedMapVersion: input.seed.selectedMapVersion, activationSnapshotRef: input.seed.activationSnapshotRef,
    capabilityCallId: input.seed.capabilityCallId, nerveBusEnvelopeId: input.seed.nerveBusEnvelopeId,
    sourceAbilityGroupId: input.seed.sourceAbilityGroupId, sourceChildCapabilityId: input.seed.sourceChildCapabilityId,
    parseErrorRef: input.seed.parseErrorRef, receivedShapeHash: input.seed.receivedShapeHash, geometryGuardRef: input.seed.geometryGuardRef,
    geometryGuardProofRef: input.seed.geometryGuardProofRef, geometryGuardOutputRef: input.seed.geometryGuardOutputRef,
    geometryGuardRuntimeProofRef: input.seed.geometryGuardRuntimeProofRef, sourceCoordinateProofRef: input.seed.sourceCoordinateProofRef,
    sourceTargetRef: input.seed.sourceTargetRef, sourceEvidenceRef: input.seed.sourceEvidenceRef, sourceVisualTargetResultRef: input.seed.sourceVisualTargetResultRef,
    inputRef: input.seed.inputRef, sourceRef: input.seed.sourceRef, outputRef, diagnosticPayloadRef,
    coordinateSpace: input.seed.coordinateSpace, sourceCoordinateSpace: input.seed.sourceCoordinateSpace,
    requestedExecutionSpace: input.seed.coordinateSpace, normalizedCoordinateSpace: input.seed.coordinateSpace,
    requestedCoordinate: input.requestedCoordinate, executableCoordinate: input.status === "success" ? input.executableCoordinate : null,
    bounds: input.seed.targetBounds, sourceBounds: input.seed.sourceBounds, targetBounds: input.seed.targetBounds,
    coordinateRoundingDecision: input.coordinateRoundingDecision, scaleDecision: "not_applicable", transformDecision: "geometry_guard_normalized_coordinate_accepted",
  };
}

function buildRuntimeProofOutcome(input: Parameters<typeof buildMouseClickResult>[0], verification: ReturnType<typeof buildVerificationState>) {
  return {
    button: input.seed.button,
    clickCount: input.seed.clickCount,
    actionExecutionRef: input.actionExecutionRef,
    rejectionRef: input.rejectionRef,
    idempotencyKey: input.idempotencyKey,
    idempotencyDecision: input.idempotencyDecision,
    primitiveExecutionRef: input.primitiveExecutionRef,
    primitiveCallId: input.primitiveCallId,
    timeoutMs: input.seed.timeoutMs,
    primitiveTimeoutMs: input.primitiveTimeoutMs,
    maxDurationMs: input.maxDurationMs,
    timeoutDecision: input.timeoutDecision,
    abortDecision: input.abortDecision,
    circuitBreakerState: input.circuitBreakerState,
    clickSuppressedReason: input.clickSuppressedReason,
    primitivePortKind: input.primitivePortKind,
    primitiveStartedAt: input.primitiveStartedAt,
    primitiveEndedAt: input.primitiveEndedAt,
    postClickObservation: verification.postClickObservation,
    postClickObservationRef: verification.postClickObservationRef,
    postActionVerificationRequired: verification.postActionVerificationRequired,
    postActionVerificationHandoffRef: verification.postActionVerificationHandoffRef,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    durationMs: input.durationMs,
    status: input.status,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    preActionDecision: input.preActionDecision,
    policyDecision: input.policyDecision,
    policyDecisionReason: input.policyDecisionReason,
    geometryDecision: input.geometryDecision,
    safetyDecision: input.safetyDecision,
    safetyDecisionReason: input.safetyDecisionReason,
    primitiveDecision: input.primitiveDecision,
    dataQualityFlags: input.dataQualityFlags,
    clock: input.clock,
  };
}

function buildRuntimeProofInput(
  input: Parameters<typeof buildMouseClickResult>[0],
  outputRef: string,
  diagnosticPayloadRef: string | null,
  verification: ReturnType<typeof buildVerificationState>,
) {
  return {
    ...buildRuntimeProofSeed(input, outputRef, diagnosticPayloadRef),
    ...buildRuntimeProofOutcome(input, verification),
  };
}

export function buildMouseClickResult(input: {
  seed: MouseClickResultSeed;
  idempotencyKey: string | null;
  idempotencyDecision: "reserved" | "duplicate_review_required" | "cooldown_blocked" | null;
  actionExecutionRef: string | null;
  rejectionRef: string | null;
  status: "success" | "failed" | "review_required";
  failureReason: string | null;
  reviewRequiredReason: string | null;
  statusMessage: string;
  preActionDecision: "allow" | "blocked" | "review_required";
  requestedCoordinate: { x: number; y: number } | null;
  executableCoordinate: { x: number; y: number } | null;
  primitiveExecutionRef: string | null;
  policyDecision: "allow" | "block" | "review_required" | "duplicate_review_required";
  policyDecisionReason: string | null;
  geometryDecision: "allow" | "block";
  safetyDecision: "allow" | "block";
  safetyDecisionReason: string | null;
  coordinateRoundingDecision: string | null;
  primitiveDecision: "not_run" | "succeeded" | "failed" | "threw" | "aborted";
  primitiveCallId: string | null;
  primitiveTimeoutMs: number;
  maxDurationMs: number;
  timeoutDecision: "within_limit" | "timed_out";
  abortDecision: "not_requested" | "timeout_abort_requested";
  circuitBreakerState: "closed" | "open";
  clickSuppressedReason: string | null;
  primitivePortKind: string;
  primitiveStartedAt: string | null;
  primitiveEndedAt: string | null;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  clock: { startedMonotonicMs: number; endedMonotonicMs: number };
  dataQualityFlags: string[];
}) {
  const outputRef = buildStableMouseClickRef("mouse-click-output", [input.seed.attemptRef, input.status]);
  const verification = buildVerificationState(input, outputRef);
  const output = buildSuccessOutput(input, outputRef, verification);
  const diagnosticPayloadRef = buildDiagnosticPayloadRef(input);
  const runtimeProof = buildMouseClickRuntimeProof(buildRuntimeProofInput(input, outputRef, diagnosticPayloadRef, verification));

  return MouseClickAbilityResultSchema.parse({
    abilityGroupId: "mouse-click", childCapabilityId: input.seed.childCapabilityId, status: input.status,
    missionId: input.seed.missionId, runId: input.seed.runId, sessionId: input.seed.sessionId, roundId: input.seed.roundId,
    videoVisitId: input.seed.videoVisitId, stepId: input.seed.stepId, mapPackageId: input.seed.mapPackageId,
    mapPackageVersion: input.seed.mapPackageVersion, selectedMapId: input.seed.selectedMapId, selectedMapVersion: input.seed.selectedMapVersion,
    activationSnapshotRef: input.seed.activationSnapshotRef, capabilityCallId: input.seed.capabilityCallId, nerveBusEnvelopeId: input.seed.nerveBusEnvelopeId,
    clickResultRef: outputRef,
    attemptRef: input.seed.attemptRef, diagnosticPayloadRef, output, failureReason: input.failureReason, reviewRequiredReason: input.reviewRequiredReason,
    statusMessage: input.statusMessage, geometryGuardRef: input.seed.geometryGuardRef, policyDecision: input.policyDecision, geometryGuardProofRef: input.seed.geometryGuardProofRef,
    sourceCoordinateProofRef: input.seed.sourceCoordinateProofRef, sourceTargetRef: input.seed.sourceTargetRef,
    sourceVisualTargetResultRef: input.seed.sourceVisualTargetResultRef, geometryDecision: input.geometryDecision, safetyDecision: input.safetyDecision,
    primitiveDecision: input.primitiveDecision, timeoutDecision: input.timeoutDecision, abortDecision: input.abortDecision,
    idempotencyDecision: input.idempotencyDecision,
    postClickObservationRef: verification.postClickObservationRef,
    postActionVerificationRequired: verification.postActionVerificationRequired,
    postActionVerificationHandoffRef: verification.postActionVerificationHandoffRef,
    dataQualityFlags: input.dataQualityFlags,
    runtimeProof,
  });
}