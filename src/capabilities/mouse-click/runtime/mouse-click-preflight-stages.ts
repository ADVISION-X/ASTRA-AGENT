import type { MouseClickAbilityContext, MouseClickCoordinateSpace, ParsedMouseClickAbilityInput } from "../contract.js";
import { buildStableMouseClickRef } from "../shared/mouse-click-types.js";
import { validateClickPolicy } from "./click-policy-gate.js";
import { validateGeometryProof } from "./geometry-proof-gate.js";
import { validateMouseClickBoundary } from "./mouse-click-boundary-gate.js";
import { buildMouseClickExecutionSeed } from "./mouse-click-input-gate.js";
import { buildRejectedMouseClickResult } from "./mouse-click-rejection-result.js";
import { validatePreClickSafety } from "./pre-click-safety-gate.js";

export type MouseClickExecutorInput = {
  request: ParsedMouseClickAbilityInput;
  expectedCoordinateSpace: MouseClickCoordinateSpace;
  context: MouseClickAbilityContext;
};

export type MouseClickPreflightState = {
  seed: ReturnType<typeof buildMouseClickExecutionSeed>;
  safetyGate: ReturnType<typeof validatePreClickSafety> & { ok: true };
  reservation: ReturnType<MouseClickAbilityContext["idempotency"]["reserve"]> & { ok: true };
};

type MouseClickPreflightResult =
  | { ok: true; state: MouseClickPreflightState }
  | { ok: false; result: ReturnType<typeof buildRejectedMouseClickResult> };

const rejectGeometryStage = (
  input: MouseClickExecutorInput,
  seed: ReturnType<typeof buildMouseClickExecutionSeed>,
  geometryGate: ReturnType<typeof validateGeometryProof> & { ok: false },
) => buildRejectedMouseClickResult({
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

const rejectPolicyStage = (
  input: MouseClickExecutorInput,
  seed: ReturnType<typeof buildMouseClickExecutionSeed>,
  policyGate: ReturnType<typeof validateClickPolicy> & { ok: false },
) => buildRejectedMouseClickResult({
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

const rejectBoundaryStage = (
  input: MouseClickExecutorInput,
  seed: ReturnType<typeof buildMouseClickExecutionSeed>,
  boundaryGate: ReturnType<typeof validateMouseClickBoundary> & { ok: false },
) => buildRejectedMouseClickResult({
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

const rejectSafetyStage = (
  input: MouseClickExecutorInput,
  seed: ReturnType<typeof buildMouseClickExecutionSeed>,
  safetyGate: ReturnType<typeof validatePreClickSafety> & { ok: false },
) => buildRejectedMouseClickResult({
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

const rejectReservationStage = (
  input: MouseClickExecutorInput,
  seed: ReturnType<typeof buildMouseClickExecutionSeed>,
  safetyGate: ReturnType<typeof validatePreClickSafety> & { ok: true },
  reservation: ReturnType<MouseClickAbilityContext["idempotency"]["reserve"]> & { ok: false },
) => buildRejectedMouseClickResult({
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

function reserveMouseClick(input: {
  executorInput: MouseClickExecutorInput;
  seed: ReturnType<typeof buildMouseClickExecutionSeed>;
  safetyGate: ReturnType<typeof validatePreClickSafety> & { ok: true };
}) {
  input.executorInput.context.idempotency.cleanupExpired(input.executorInput.context.clock.now().monotonicMs);
  return input.executorInput.context.idempotency.reserve({
    sessionId: input.seed.sessionId,
    roundId: input.seed.roundId,
    videoVisitId: input.seed.videoVisitId,
    geometryGuardRef: input.seed.geometryGuardRef,
    purpose: input.seed.purpose,
    coordinate: input.safetyGate.executableCoordinate,
    button: input.seed.button,
    clickCount: input.seed.clickCount,
    nowMs: input.executorInput.context.clock.now().monotonicMs,
    allowReplay: input.seed.safetyPolicy.allowReplay,
    cooldownMs: input.seed.safetyPolicy.cooldownMs,
    ttlMs: input.seed.safetyPolicy.idempotencyTtlMs,
  });
}

function runMouseClickGateStages(
  input: MouseClickExecutorInput,
  seed: ReturnType<typeof buildMouseClickExecutionSeed>,
) {
  const geometryGate = validateGeometryProof({ request: input.request, expectedCoordinateSpace: input.expectedCoordinateSpace });
  if (!geometryGate.ok) {
    return { ok: false as const, result: rejectGeometryStage(input, seed, geometryGate) };
  }

  const policyGate = validateClickPolicy({ request: input.request, nowIsoTimestamp: input.context.clock.now().isoTimestamp });
  if (!policyGate.ok) {
    return { ok: false as const, result: rejectPolicyStage(input, seed, policyGate) };
  }

  const boundaryGate = validateMouseClickBoundary({ request: input.request, expectedCoordinateSpace: input.expectedCoordinateSpace });
  if (!boundaryGate.ok) {
    return { ok: false as const, result: rejectBoundaryStage(input, seed, boundaryGate) };
  }

  const safetyGate = validatePreClickSafety({ request: input.request, expectedCoordinateSpace: input.expectedCoordinateSpace });
  return safetyGate.ok
    ? { ok: true as const, safetyGate }
    : { ok: false as const, result: rejectSafetyStage(input, seed, safetyGate) };
}

function runMouseClickReservationStage(
  input: MouseClickExecutorInput,
  seed: ReturnType<typeof buildMouseClickExecutionSeed>,
  safetyGate: ReturnType<typeof validatePreClickSafety> & { ok: true },
): MouseClickPreflightResult {
  const reservation = reserveMouseClick({ executorInput: input, seed, safetyGate });
  if (!reservation.ok) {
    return { ok: false, result: rejectReservationStage(input, seed, safetyGate, reservation) };
  }

  return { ok: true, state: { seed, safetyGate, reservation } };
}

export function runMouseClickPreflightStages(input: MouseClickExecutorInput): MouseClickPreflightResult {
  const seed = buildMouseClickExecutionSeed(input.request);
  const gateStage = runMouseClickGateStages(input, seed);
  return gateStage.ok
    ? runMouseClickReservationStage(input, seed, gateStage.safetyGate)
    : gateStage;
}