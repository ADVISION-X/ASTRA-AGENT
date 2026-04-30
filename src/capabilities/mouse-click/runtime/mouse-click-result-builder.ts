import type { MouseClickResultSeed } from "./mouse-click-input-gate.js";
import { MouseClickAbilityResultSchema } from "../schema.js";
import { buildStableMouseClickRef } from "../shared/mouse-click-types.js";
import { buildMouseClickRuntimeProof } from "./mouse-click-proof-builder.js";

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
  const postActionVerificationRequired = input.status === "success";
  const postActionVerificationHandoffRef = postActionVerificationRequired && input.actionExecutionRef && input.primitiveExecutionRef
    ? buildStableMouseClickRef("mouse-click-post-action-verification", [input.actionExecutionRef, input.primitiveExecutionRef])
    : null;
  const output = input.status === "success" && input.actionExecutionRef && input.primitiveExecutionRef && input.executableCoordinate
    ? {
        attemptRef: input.seed.attemptRef,
        actionExecutionRef: input.actionExecutionRef,
        primitiveExecutionRef: input.primitiveExecutionRef,
        normalizedClickPoint: input.executableCoordinate,
        coordinateSpace: input.seed.coordinateSpace,
        button: input.seed.button,
        clickCount: input.seed.clickCount,
        postActionVerificationRequired: true as const,
        postActionVerificationHandoffRef,
      }
    : null;

  const runtimeProof = buildMouseClickRuntimeProof({
    attemptRef: input.seed.attemptRef,
    childCapabilityId: input.seed.childCapabilityId,
    sessionId: input.seed.sessionId,
    roundId: input.seed.roundId,
    videoVisitId: input.seed.videoVisitId,
    sourceAbilityGroupId: input.seed.sourceAbilityGroupId,
    sourceChildCapabilityId: input.seed.sourceChildCapabilityId,
    parseErrorRef: input.seed.parseErrorRef,
    receivedShapeHash: input.seed.receivedShapeHash,
    geometryGuardRef: input.seed.geometryGuardRef,
    geometryGuardProofRef: input.seed.geometryGuardProofRef,
    sourceCoordinateProofRef: input.seed.sourceCoordinateProofRef,
    sourceTargetRef: input.seed.sourceTargetRef,
    sourceEvidenceRef: input.seed.sourceEvidenceRef,
    inputRef: input.seed.inputRef,
    outputRef,
    coordinateSpace: input.seed.coordinateSpace,
    sourceCoordinateSpace: input.seed.sourceCoordinateSpace,
    requestedExecutionSpace: input.seed.coordinateSpace,
    normalizedCoordinateSpace: input.seed.coordinateSpace,
    requestedCoordinate: input.requestedCoordinate,
    executableCoordinate: input.status === "success" ? input.executableCoordinate : null,
    bounds: input.seed.targetBounds,
    sourceBounds: input.seed.sourceBounds,
    targetBounds: input.seed.targetBounds,
    coordinateRoundingDecision: input.coordinateRoundingDecision,
    scaleDecision: "not_applicable",
    transformDecision: "geometry_guard_normalized_coordinate_accepted",
    button: input.seed.button,
    clickCount: input.seed.clickCount,
    actionExecutionRef: input.actionExecutionRef,
    rejectionRef: input.rejectionRef,
    idempotencyKey: input.idempotencyKey,
    idempotencyDecision: input.idempotencyDecision,
    primitiveExecutionRef: input.primitiveExecutionRef,
    primitiveCallId: input.primitiveCallId,
    primitiveTimeoutMs: input.primitiveTimeoutMs,
    maxDurationMs: input.maxDurationMs,
    timeoutDecision: input.timeoutDecision,
    abortDecision: input.abortDecision,
    circuitBreakerState: input.circuitBreakerState,
    clickSuppressedReason: input.clickSuppressedReason,
    primitivePortKind: input.primitivePortKind,
    primitiveStartedAt: input.primitiveStartedAt,
    primitiveEndedAt: input.primitiveEndedAt,
    postActionVerificationRequired,
    postActionVerificationHandoffRef,
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
  });

  return MouseClickAbilityResultSchema.parse({
    abilityGroupId: "mouse-click",
    childCapabilityId: input.seed.childCapabilityId,
    status: input.status,
    sessionId: input.seed.sessionId,
    roundId: input.seed.roundId,
    videoVisitId: input.seed.videoVisitId,
    attemptRef: input.seed.attemptRef,
    output,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    statusMessage: input.statusMessage,
    policyDecision: input.policyDecision,
    dataQualityFlags: input.dataQualityFlags,
    runtimeProof,
  });
}