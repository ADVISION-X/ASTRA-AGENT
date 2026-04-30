import type { MouseClickAbilityContext, MouseClickCoordinateSpace, ParsedMouseClickAbilityInput } from "../contract.js";
import { buildStableMouseClickRef } from "../shared/mouse-click-types.js";
import { validateClickPolicy } from "./click-policy-gate.js";
import { validateGeometryProof } from "./geometry-proof-gate.js";
import { validateMouseClickBoundary } from "./mouse-click-boundary-gate.js";
import { buildMouseClickExecutionSeed } from "./mouse-click-input-gate.js";
import { buildMouseClickResult } from "./mouse-click-result-builder.js";
import { validatePreClickSafety } from "./pre-click-safety-gate.js";
import { runPrimitiveClick } from "./primitive-click-runner.js";

function buildRejectedMouseClickResult(input: {
  seed: ReturnType<typeof buildMouseClickExecutionSeed>;
  context: MouseClickAbilityContext;
  idempotencyKey: string | null;
  idempotencyDecision: "reserved" | "duplicate_review_required" | "cooldown_blocked" | null;
  actionExecutionRef: string | null;
  rejectionRef: string;
  status: "failed" | "review_required";
  failureReason: string | null;
  reviewRequiredReason: string | null;
  statusMessage: string;
  preActionDecision: "blocked" | "review_required";
  requestedCoordinate: { x: number; y: number } | null;
  policyDecision: "allow" | "block" | "review_required" | "duplicate_review_required";
  policyDecisionReason: string | null;
  geometryDecision: "allow" | "block";
  safetyDecision: "allow" | "block";
  safetyDecisionReason: string | null;
  coordinateRoundingDecision: string | null;
  clickSuppressedReason: string | null;
  dataQualityFlags: string[];
}) {
  const startedSnapshot = input.context.clock.now();
  const endedSnapshot = input.context.clock.now();

  return buildMouseClickResult({
    seed: input.seed,
    idempotencyKey: input.idempotencyKey,
    idempotencyDecision: input.idempotencyDecision,
    actionExecutionRef: input.actionExecutionRef,
    rejectionRef: input.rejectionRef,
    status: input.status,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    statusMessage: input.statusMessage,
    preActionDecision: input.preActionDecision,
    requestedCoordinate: input.requestedCoordinate,
    executableCoordinate: null,
    primitiveExecutionRef: null,
    policyDecision: input.policyDecision,
    policyDecisionReason: input.policyDecisionReason,
    geometryDecision: input.geometryDecision,
    safetyDecision: input.safetyDecision,
    safetyDecisionReason: input.safetyDecisionReason,
    coordinateRoundingDecision: input.coordinateRoundingDecision,
    primitiveDecision: "not_run",
    primitiveCallId: null,
    primitiveTimeoutMs: input.seed.safetyPolicy.primitiveTimeoutMs,
    maxDurationMs: input.seed.safetyPolicy.maxDurationMs,
    timeoutDecision: "within_limit",
    abortDecision: "not_requested",
    circuitBreakerState: "closed",
    clickSuppressedReason: input.clickSuppressedReason,
    primitivePortKind: "not-run",
    primitiveStartedAt: null,
    primitiveEndedAt: null,
    startedAt: startedSnapshot.isoTimestamp,
    endedAt: endedSnapshot.isoTimestamp,
    durationMs: Math.max(0, Math.round(endedSnapshot.monotonicMs - startedSnapshot.monotonicMs)),
    clock: { startedMonotonicMs: startedSnapshot.monotonicMs, endedMonotonicMs: endedSnapshot.monotonicMs },
    dataQualityFlags: input.dataQualityFlags,
  });
}

export async function executeMouseClick(input: {
  request: ParsedMouseClickAbilityInput;
  expectedCoordinateSpace: MouseClickCoordinateSpace;
  context: MouseClickAbilityContext;
}) {
  const seed = buildMouseClickExecutionSeed(input.request);

  const geometryGate = validateGeometryProof({ request: input.request, expectedCoordinateSpace: input.expectedCoordinateSpace });
  if (!geometryGate.ok) {
    return buildRejectedMouseClickResult({
      seed,
      context: input.context,
      idempotencyKey: null,
      idempotencyDecision: null,
      actionExecutionRef: null,
      rejectionRef: buildStableMouseClickRef("mouse-click-rejection", [seed.attemptRef, "geometry"]),
      status: geometryGate.status,
      failureReason: geometryGate.failureReason,
      reviewRequiredReason: geometryGate.reviewRequiredReason,
      statusMessage: geometryGate.statusMessage,
      preActionDecision: "blocked",
      requestedCoordinate: seed.requestedCoordinate,
      policyDecision: "block",
      policyDecisionReason: geometryGate.geometryDecisionReason,
      geometryDecision: geometryGate.geometryDecision,
      safetyDecision: "block",
      safetyDecisionReason: geometryGate.geometryDecisionReason,
      coordinateRoundingDecision: null,
      clickSuppressedReason: geometryGate.failureReason,
      dataQualityFlags: geometryGate.dataQualityFlags,
    });
  }

  const policyGate = validateClickPolicy({ request: input.request, nowIsoTimestamp: input.context.clock.now().isoTimestamp });
  if (!policyGate.ok) {
    return buildRejectedMouseClickResult({
      seed,
      context: input.context,
      idempotencyKey: null,
      idempotencyDecision: null,
      actionExecutionRef: null,
      rejectionRef: buildStableMouseClickRef("mouse-click-rejection", [seed.attemptRef, "policy"]),
      status: policyGate.status,
      failureReason: policyGate.failureReason,
      reviewRequiredReason: policyGate.reviewRequiredReason,
      statusMessage: policyGate.statusMessage,
      preActionDecision: policyGate.status === "review_required" ? "review_required" : "blocked",
      requestedCoordinate: seed.requestedCoordinate,
      policyDecision: policyGate.policyDecision,
      policyDecisionReason: policyGate.policyDecisionReason,
      geometryDecision: "allow",
      safetyDecision: "block",
      safetyDecisionReason: policyGate.policyDecisionReason,
      coordinateRoundingDecision: null,
      clickSuppressedReason: policyGate.failureReason ?? policyGate.reviewRequiredReason,
      dataQualityFlags: policyGate.dataQualityFlags,
    });
  }

  const boundaryGate = validateMouseClickBoundary({ request: input.request, expectedCoordinateSpace: input.expectedCoordinateSpace });
  if (!boundaryGate.ok) {
    return buildRejectedMouseClickResult({
      seed,
      context: input.context,
      idempotencyKey: null,
      idempotencyDecision: null,
      actionExecutionRef: null,
      rejectionRef: buildStableMouseClickRef("mouse-click-rejection", [seed.attemptRef, "boundary"]),
      status: "failed",
      failureReason: boundaryGate.failureReason,
      reviewRequiredReason: null,
      statusMessage: boundaryGate.statusMessage,
      preActionDecision: "blocked",
      requestedCoordinate: seed.requestedCoordinate,
      policyDecision: boundaryGate.policyDecision,
      policyDecisionReason: boundaryGate.boundaryReason,
      geometryDecision: "allow",
      safetyDecision: "block",
      safetyDecisionReason: boundaryGate.boundaryReason,
      coordinateRoundingDecision: null,
      clickSuppressedReason: boundaryGate.failureReason,
      dataQualityFlags: boundaryGate.dataQualityFlags,
    });
  }

  const safetyGate = validatePreClickSafety({ request: input.request, expectedCoordinateSpace: input.expectedCoordinateSpace });
  if (!safetyGate.ok) {
    return buildRejectedMouseClickResult({
      seed,
      context: input.context,
      idempotencyKey: null,
      idempotencyDecision: null,
      actionExecutionRef: null,
      rejectionRef: buildStableMouseClickRef("mouse-click-rejection", [seed.attemptRef, "safety"]),
      status: "failed",
      failureReason: safetyGate.failureReason,
      reviewRequiredReason: null,
      statusMessage: safetyGate.statusMessage,
      preActionDecision: "blocked",
      requestedCoordinate: seed.requestedCoordinate,
      policyDecision: safetyGate.policyDecision,
      policyDecisionReason: safetyGate.safetyDecisionReason,
      geometryDecision: "allow",
      safetyDecision: safetyGate.safetyDecision,
      safetyDecisionReason: safetyGate.safetyDecisionReason,
      coordinateRoundingDecision: null,
      clickSuppressedReason: safetyGate.failureReason,
      dataQualityFlags: safetyGate.dataQualityFlags,
    });
  }

  input.context.idempotency.cleanupExpired(input.context.clock.now().monotonicMs);
  const reservation = input.context.idempotency.reserve({
    sessionId: seed.sessionId,
    roundId: seed.roundId,
    videoVisitId: seed.videoVisitId,
    geometryGuardRef: seed.geometryGuardRef,
    purpose: seed.purpose,
    coordinate: safetyGate.executableCoordinate,
    button: seed.button,
    clickCount: seed.clickCount,
    nowMs: input.context.clock.now().monotonicMs,
    allowReplay: seed.safetyPolicy.allowReplay,
    cooldownMs: seed.safetyPolicy.cooldownMs,
    ttlMs: seed.safetyPolicy.idempotencyTtlMs,
  });
  if (!reservation.ok) {
    return buildRejectedMouseClickResult({
      seed,
      context: input.context,
      idempotencyKey: reservation.idempotencyKey,
      idempotencyDecision: reservation.idempotencyDecision,
      actionExecutionRef: null,
      rejectionRef: reservation.rejectionRef,
      status: reservation.status,
      failureReason: reservation.failureReason,
      reviewRequiredReason: reservation.reviewRequiredReason,
      statusMessage: reservation.statusMessage,
      preActionDecision: reservation.status === "review_required" ? "review_required" : "blocked",
      requestedCoordinate: safetyGate.requestedCoordinate,
      policyDecision: reservation.policyDecision,
      policyDecisionReason: reservation.failureReason,
      geometryDecision: "allow",
      safetyDecision: "allow",
      safetyDecisionReason: safetyGate.safetyDecisionReason,
      coordinateRoundingDecision: safetyGate.coordinateRoundingDecision,
      clickSuppressedReason: reservation.failureReason,
      dataQualityFlags: reservation.dataQualityFlags,
    });
  }

  const primitiveResult = await runPrimitiveClick({
    context: input.context,
    attemptRef: seed.attemptRef,
    actionExecutionRef: reservation.actionExecutionRef,
    idempotencyKey: reservation.idempotencyKey,
    sessionId: seed.sessionId,
    roundId: seed.roundId,
    videoVisitId: seed.videoVisitId,
    geometryGuardProofRef: seed.geometryGuardProofRef ?? seed.sourceCoordinateProofRef ?? seed.inputRef,
    sourceCoordinateProofRef: seed.sourceCoordinateProofRef ?? seed.inputRef,
    sourceTargetRef: seed.sourceTargetRef ?? seed.inputRef,
    operatorApprovalRef: seed.safetyPolicy.desktopScreenOperatorApprovalRef,
    targetLabel: `${seed.purpose}:${seed.childCapabilityId}`,
    coordinateSpace: input.expectedCoordinateSpace,
    executableCoordinate: safetyGate.executableCoordinate,
    button: seed.button,
    clickCount: seed.clickCount,
    timeoutMs: seed.safetyPolicy.primitiveTimeoutMs,
    maxDurationMs: seed.safetyPolicy.maxDurationMs,
  });

  if (!primitiveResult.ok) {
    return buildMouseClickResult({
      seed,
      idempotencyKey: reservation.idempotencyKey,
      idempotencyDecision: reservation.idempotencyDecision,
      actionExecutionRef: reservation.actionExecutionRef,
      rejectionRef: buildStableMouseClickRef("mouse-click-rejection", [seed.attemptRef, primitiveResult.failureReason]),
      status: "failed",
      failureReason: primitiveResult.failureReason,
      reviewRequiredReason: null,
      statusMessage: primitiveResult.statusMessage,
      preActionDecision: "allow",
      requestedCoordinate: safetyGate.requestedCoordinate,
      executableCoordinate: null,
      primitiveExecutionRef: primitiveResult.primitiveExecutionRef,
      policyDecision: "allow",
      policyDecisionReason: "policy_gate_passed",
      geometryDecision: "allow",
      safetyDecision: "allow",
      safetyDecisionReason: safetyGate.safetyDecisionReason,
      coordinateRoundingDecision: safetyGate.coordinateRoundingDecision,
      primitiveDecision: primitiveResult.primitiveDecision,
      primitiveCallId: primitiveResult.primitiveCallId,
      primitiveTimeoutMs: seed.safetyPolicy.primitiveTimeoutMs,
      maxDurationMs: seed.safetyPolicy.maxDurationMs,
      timeoutDecision: primitiveResult.timeoutDecision,
      abortDecision: primitiveResult.abortDecision,
      circuitBreakerState: primitiveResult.circuitBreakerState,
      clickSuppressedReason: primitiveResult.failureReason,
      primitivePortKind: primitiveResult.primitivePortKind,
      primitiveStartedAt: primitiveResult.primitiveStartedAt,
      primitiveEndedAt: primitiveResult.primitiveEndedAt,
      startedAt: primitiveResult.startedAt,
      endedAt: primitiveResult.endedAt,
      durationMs: primitiveResult.durationMs,
      clock: primitiveResult.clock,
      dataQualityFlags: primitiveResult.dataQualityFlags,
    });
  }

  return buildMouseClickResult({
    seed,
    idempotencyKey: reservation.idempotencyKey,
    idempotencyDecision: reservation.idempotencyDecision,
    actionExecutionRef: reservation.actionExecutionRef,
    rejectionRef: null,
    status: "success",
    failureReason: null,
    reviewRequiredReason: null,
    statusMessage: primitiveResult.statusMessage,
    preActionDecision: "allow",
    requestedCoordinate: safetyGate.requestedCoordinate,
    executableCoordinate: safetyGate.executableCoordinate,
    primitiveExecutionRef: primitiveResult.primitiveExecutionRef,
    policyDecision: "allow",
    policyDecisionReason: "policy_gate_passed",
    geometryDecision: "allow",
    safetyDecision: "allow",
    safetyDecisionReason: safetyGate.safetyDecisionReason,
    coordinateRoundingDecision: safetyGate.coordinateRoundingDecision,
    primitiveDecision: primitiveResult.primitiveDecision,
    primitiveCallId: primitiveResult.primitiveCallId,
    primitiveTimeoutMs: seed.safetyPolicy.primitiveTimeoutMs,
    maxDurationMs: seed.safetyPolicy.maxDurationMs,
    timeoutDecision: primitiveResult.timeoutDecision,
    abortDecision: primitiveResult.abortDecision,
    circuitBreakerState: primitiveResult.circuitBreakerState,
    clickSuppressedReason: null,
    primitivePortKind: primitiveResult.primitivePortKind,
    primitiveStartedAt: primitiveResult.primitiveStartedAt,
    primitiveEndedAt: primitiveResult.primitiveEndedAt,
    startedAt: primitiveResult.startedAt,
    endedAt: primitiveResult.endedAt,
    durationMs: primitiveResult.durationMs,
    clock: primitiveResult.clock,
    dataQualityFlags: [],
  });
}