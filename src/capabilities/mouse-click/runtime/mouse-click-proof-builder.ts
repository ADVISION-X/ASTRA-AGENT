import type { MouseClickButton, MouseClickChildCapabilityId, MouseClickCoordinateSpace, MouseClickCount } from "../contract.js";
import { MouseClickRuntimeProofSchema } from "../schema.js";
import { MOUSE_CLICK_PROOF } from "../shared/mouse-click-proof.js";
import { buildStableMouseClickRef } from "../shared/mouse-click-types.js";

function buildProofIdentity(input: Parameters<typeof buildMouseClickRuntimeProof>[0]) {
  return {
    proofId: buildStableMouseClickRef("mouse-click-proof", [input.attemptRef, input.status]),
    runId: buildStableMouseClickRef("mouse-click-run", [input.attemptRef, input.childCapabilityId]),
    missionId: input.sessionId ?? input.attemptRef,
    sessionId: input.sessionId,
    roundId: input.roundId,
    videoVisitId: input.videoVisitId,
    abilityGroupId: "mouse-click",
    childCapabilityId: input.childCapabilityId,
    sourceAbilityGroupId: input.sourceAbilityGroupId,
    sourceChildCapabilityId: input.sourceChildCapabilityId,
    inputRef: input.inputRef,
    outputRef: input.outputRef,
    attemptRef: input.attemptRef,
  };
}

function buildProofGeometry(input: Parameters<typeof buildMouseClickRuntimeProof>[0]) {
  return {
    actionExecutionRef: input.actionExecutionRef,
    rejectionRef: input.rejectionRef,
    parseErrorRef: input.parseErrorRef,
    receivedShapeHash: input.receivedShapeHash,
    geometryGuardRef: input.geometryGuardRef,
    geometryGuardProofRef: input.geometryGuardProofRef,
    sourceCoordinateProofRef: input.sourceCoordinateProofRef,
    sourceTargetRef: input.sourceTargetRef,
    sourceEvidenceRef: input.sourceEvidenceRef,
    coordinateSpace: input.coordinateSpace,
    sourceCoordinateSpace: input.sourceCoordinateSpace,
    requestedExecutionSpace: input.requestedExecutionSpace,
    normalizedCoordinateSpace: input.normalizedCoordinateSpace,
    requestedCoordinate: input.requestedCoordinate,
    executableCoordinate: input.executableCoordinate,
    bounds: input.bounds,
    sourceBounds: input.sourceBounds,
    targetBounds: input.targetBounds,
    coordinateRoundingDecision: input.coordinateRoundingDecision,
    scaleDecision: input.scaleDecision,
    transformDecision: input.transformDecision,
  };
}

function buildProofPrimitive(input: Parameters<typeof buildMouseClickRuntimeProof>[0]) {
  return {
    button: input.button,
    clickCount: input.clickCount,
    preActionDecision: input.preActionDecision,
    policyDecision: input.policyDecision,
    policyDecisionReason: input.policyDecisionReason,
    geometryDecision: input.geometryDecision,
    safetyDecision: input.safetyDecision,
    safetyDecisionReason: input.safetyDecisionReason,
    idempotencyKey: input.idempotencyKey,
    idempotencyDecision: input.idempotencyDecision,
    primitiveDecision: input.primitiveDecision,
    primitiveCallId: input.primitiveCallId,
    primitiveExecutionRef: input.primitiveExecutionRef,
    primitiveTimeoutMs: input.primitiveTimeoutMs,
    maxDurationMs: input.maxDurationMs,
    timeoutDecision: input.timeoutDecision,
    abortDecision: input.abortDecision,
    circuitBreakerState: input.circuitBreakerState,
    clickSuppressedReason: input.clickSuppressedReason,
    primitivePortKind: input.primitivePortKind,
    primitiveStartedAt: input.primitiveStartedAt,
    primitiveEndedAt: input.primitiveEndedAt,
  };
}

function buildProofOutcome(input: Parameters<typeof buildMouseClickRuntimeProof>[0]) {
  return {
    postActionVerificationRequired: input.postActionVerificationRequired,
    postActionVerificationHandoffRef: input.postActionVerificationHandoffRef,
    verificationRefPolicy: MOUSE_CLICK_PROOF.VERIFICATION_REF_POLICY,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    durationMs: input.durationMs,
    status: input.status,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    dataQualityFlags: input.dataQualityFlags,
    clock: {
      portKind: "system-monotonic-clock",
      startedMonotonicMs: input.clock.startedMonotonicMs,
      endedMonotonicMs: input.clock.endedMonotonicMs,
    },
  };
}

export function buildMouseClickRuntimeProof(input: {
  attemptRef: string;
  childCapabilityId: MouseClickChildCapabilityId;
  sessionId: string | null;
  roundId: string | null;
  videoVisitId: string | null;
  sourceAbilityGroupId: string | null;
  sourceChildCapabilityId: string | null;
  parseErrorRef: string | null;
  receivedShapeHash: string | null;
  geometryGuardRef: string | null;
  geometryGuardProofRef: string | null;
  sourceCoordinateProofRef: string | null;
  sourceTargetRef: string | null;
  sourceEvidenceRef: string | null;
  inputRef: string;
  outputRef: string;
  coordinateSpace: MouseClickCoordinateSpace;
  sourceCoordinateSpace: MouseClickCoordinateSpace | null;
  requestedExecutionSpace: MouseClickCoordinateSpace;
  normalizedCoordinateSpace: MouseClickCoordinateSpace | null;
  requestedCoordinate: { x: number; y: number } | null;
  executableCoordinate: { x: number; y: number } | null;
  bounds: { width: number; height: number } | null;
  sourceBounds: { width: number; height: number } | null;
  targetBounds: { width: number; height: number } | null;
  coordinateRoundingDecision: string | null;
  scaleDecision: string | null;
  transformDecision: string | null;
  button: MouseClickButton;
  clickCount: MouseClickCount;
  actionExecutionRef: string | null;
  rejectionRef: string | null;
  idempotencyKey: string | null;
  idempotencyDecision: "reserved" | "duplicate_review_required" | "cooldown_blocked" | null;
  primitiveExecutionRef: string | null;
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
  postActionVerificationRequired: boolean;
  postActionVerificationHandoffRef: string | null;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  status: "success" | "failed" | "review_required";
  failureReason: string | null;
  reviewRequiredReason: string | null;
  preActionDecision: "allow" | "blocked" | "review_required";
  policyDecision: "allow" | "block" | "review_required" | "duplicate_review_required";
  policyDecisionReason: string | null;
  geometryDecision: "allow" | "block";
  safetyDecision: "allow" | "block";
  safetyDecisionReason: string | null;
  primitiveDecision: "not_run" | "succeeded" | "failed" | "threw" | "aborted";
  dataQualityFlags: string[];
  clock: { startedMonotonicMs: number; endedMonotonicMs: number };
}) {
  return MouseClickRuntimeProofSchema.parse({
    ...buildProofIdentity(input),
    ...buildProofGeometry(input),
    ...buildProofPrimitive(input),
    ...buildProofOutcome(input),
  });
}