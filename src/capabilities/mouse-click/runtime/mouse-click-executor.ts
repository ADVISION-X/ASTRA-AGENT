import type { MouseClickAbilityContext, MouseClickCoordinateSpace, ParsedMouseClickAbilityInput } from "../contract.js";
import { validateClickPolicy } from "./click-policy-gate.js";
import { validateGeometryProof } from "./geometry-proof-gate.js";
import { buildMouseClickExecutionSeed } from "./mouse-click-input-gate.js";
import { buildMouseClickResult } from "./mouse-click-result-builder.js";
import { validatePreClickSafety } from "./pre-click-safety-gate.js";
import { runPrimitiveClick } from "./primitive-click-runner.js";

function buildRejectedMouseClickResult(input: {
  seed: ReturnType<typeof buildMouseClickExecutionSeed>;
  context: MouseClickAbilityContext;
  idempotencyKey: string;
  actionExecutionRef: string;
  status: "failed" | "review_required";
  failureReason: string | null;
  reviewRequiredReason: string | null;
  statusMessage: string;
  requestedCoordinate: { x: number; y: number } | null;
  policyDecision: "allow" | "block" | "review_required" | "duplicate_skipped";
  geometryDecision: "allow" | "block" | "review_required";
  dataQualityFlags: string[];
}) {
  const startedSnapshot = input.context.clock.now();
  const endedSnapshot = input.context.clock.now();

  return buildMouseClickResult({
    seed: input.seed,
    idempotencyKey: input.idempotencyKey,
    actionExecutionRef: input.actionExecutionRef,
    status: input.status,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    statusMessage: input.statusMessage,
    requestedCoordinate: input.requestedCoordinate,
    executableCoordinate: null,
    primitiveExecutionRef: null,
    policyDecision: input.policyDecision,
    geometryDecision: input.geometryDecision,
    primitiveDecision: "not_run",
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
      idempotencyKey: `geometry-failed:${seed.sessionId}:${seed.childCapabilityId}`,
      actionExecutionRef: `geometry-failed:${seed.sessionId}:${seed.childCapabilityId}`,
      status: geometryGate.status,
      failureReason: geometryGate.failureReason,
      reviewRequiredReason: geometryGate.reviewRequiredReason,
      statusMessage: geometryGate.statusMessage,
      requestedCoordinate: seed.requestedCoordinate,
      policyDecision: geometryGate.status === "review_required" ? "review_required" : "block",
      geometryDecision: geometryGate.geometryDecision,
      dataQualityFlags: geometryGate.dataQualityFlags,
    });
  }

  const policyGate = validateClickPolicy({ request: input.request });
  if (!policyGate.ok) {
    return buildRejectedMouseClickResult({
      seed,
      context: input.context,
      idempotencyKey: `policy-failed:${seed.sessionId}:${seed.childCapabilityId}`,
      actionExecutionRef: `policy-failed:${seed.sessionId}:${seed.childCapabilityId}`,
      status: policyGate.status,
      failureReason: policyGate.failureReason,
      reviewRequiredReason: policyGate.reviewRequiredReason,
      statusMessage: policyGate.statusMessage,
      requestedCoordinate: seed.requestedCoordinate,
      policyDecision: policyGate.policyDecision,
      geometryDecision: "allow",
      dataQualityFlags: policyGate.dataQualityFlags,
    });
  }

  const safetyGate = validatePreClickSafety({ request: input.request, expectedCoordinateSpace: input.expectedCoordinateSpace });
  if (!safetyGate.ok) {
    return buildRejectedMouseClickResult({
      seed,
      context: input.context,
      idempotencyKey: `safety-failed:${seed.sessionId}:${seed.childCapabilityId}`,
      actionExecutionRef: `safety-failed:${seed.sessionId}:${seed.childCapabilityId}`,
      status: "failed",
      failureReason: safetyGate.failureReason,
      reviewRequiredReason: null,
      statusMessage: safetyGate.statusMessage,
      requestedCoordinate: seed.requestedCoordinate,
      policyDecision: safetyGate.policyDecision,
      geometryDecision: "allow",
      dataQualityFlags: safetyGate.dataQualityFlags,
    });
  }

  const reservation = input.context.idempotency.reserve({
    sessionId: seed.sessionId,
    roundId: seed.roundId,
    geometryGuardRef: seed.geometryGuardRef,
    purpose: seed.purpose,
    coordinate: safetyGate.executableCoordinate,
    button: seed.button,
    clickCount: seed.clickCount,
    nowMs: input.context.clock.now().monotonicMs,
    allowReplay: seed.safetyPolicy.allowReplay,
    cooldownMs: seed.safetyPolicy.cooldownMs,
  });
  if (!reservation.ok) {
    return buildRejectedMouseClickResult({
      seed,
      context: input.context,
      idempotencyKey: reservation.idempotencyKey,
      actionExecutionRef: reservation.actionExecutionRef,
      status: reservation.status,
      failureReason: reservation.failureReason,
      reviewRequiredReason: reservation.reviewRequiredReason,
      statusMessage: reservation.statusMessage,
      requestedCoordinate: safetyGate.requestedCoordinate,
      policyDecision: reservation.policyDecision,
      geometryDecision: "allow",
      dataQualityFlags: reservation.dataQualityFlags,
    });
  }

  const primitiveResult = await runPrimitiveClick({
    context: input.context,
    actionExecutionRef: reservation.actionExecutionRef,
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
      actionExecutionRef: reservation.actionExecutionRef,
      status: "failed",
      failureReason: primitiveResult.failureReason,
      reviewRequiredReason: null,
      statusMessage: primitiveResult.statusMessage,
      requestedCoordinate: safetyGate.requestedCoordinate,
      executableCoordinate: null,
      primitiveExecutionRef: primitiveResult.primitiveExecutionRef,
      policyDecision: "allow",
      geometryDecision: "allow",
      primitiveDecision: primitiveResult.primitiveDecision,
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
    actionExecutionRef: reservation.actionExecutionRef,
    status: "success",
    failureReason: null,
    reviewRequiredReason: null,
    statusMessage: primitiveResult.statusMessage,
    requestedCoordinate: safetyGate.requestedCoordinate,
    executableCoordinate: safetyGate.executableCoordinate,
    primitiveExecutionRef: primitiveResult.primitiveExecutionRef,
    policyDecision: "allow",
    geometryDecision: "allow",
    primitiveDecision: primitiveResult.primitiveDecision,
    startedAt: primitiveResult.startedAt,
    endedAt: primitiveResult.endedAt,
    durationMs: primitiveResult.durationMs,
    clock: primitiveResult.clock,
    dataQualityFlags: [],
  });
}