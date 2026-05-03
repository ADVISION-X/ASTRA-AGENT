import { buildStableMouseClickRef } from "../shared/mouse-click-types.js";
import { runPrimitiveClick } from "./primitive-click-runner.js";
import { buildMouseClickResult } from "./mouse-click-result-builder.js";
import type { MouseClickExecutorInput, MouseClickPreflightState } from "./mouse-click-preflight-stages.js";

const buildPrimitiveBaseFields = (state: MouseClickPreflightState) => ({
  seed: state.seed,
  idempotencyKey: state.reservation.idempotencyKey,
  idempotencyDecision: state.reservation.idempotencyDecision,
  actionExecutionRef: state.reservation.actionExecutionRef,
  preActionDecision: "allow" as const,
  requestedCoordinate: state.safetyGate.requestedCoordinate,
  policyDecision: "allow" as const,
  policyDecisionReason: "policy_gate_passed",
  geometryDecision: "allow" as const,
  safetyDecision: "allow" as const,
  safetyDecisionReason: state.safetyGate.safetyDecisionReason,
  coordinateRoundingDecision: state.safetyGate.coordinateRoundingDecision,
  primitiveTimeoutMs: state.seed.timeoutMs,
  maxDurationMs: state.seed.safetyPolicy.maxDurationMs,
});

const buildPrimitiveFailureResult = (
  state: MouseClickPreflightState,
  primitiveResult: Awaited<ReturnType<typeof runPrimitiveClick>> & { ok: false },
) => buildMouseClickResult({
  ...buildPrimitiveBaseFields(state),
  rejectionRef: buildStableMouseClickRef("mouse-click-rejection", [state.seed.attemptRef, primitiveResult.failureReason]),
  status: "failed",
  failureReason: primitiveResult.failureReason,
  reviewRequiredReason: null,
  statusMessage: primitiveResult.statusMessage,
  executableCoordinate: null,
  primitiveExecutionRef: primitiveResult.primitiveExecutionRef,
  primitiveDecision: primitiveResult.primitiveDecision,
  primitiveCallId: primitiveResult.primitiveCallId,
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

const buildPrimitiveSuccessResult = (
  state: MouseClickPreflightState,
  primitiveResult: Awaited<ReturnType<typeof runPrimitiveClick>> & { ok: true },
) => buildMouseClickResult({
  ...buildPrimitiveBaseFields(state),
  rejectionRef: null,
  status: "success",
  failureReason: null,
  reviewRequiredReason: null,
  statusMessage: primitiveResult.statusMessage,
  executableCoordinate: state.safetyGate.executableCoordinate,
  primitiveExecutionRef: primitiveResult.primitiveExecutionRef,
  primitiveDecision: primitiveResult.primitiveDecision,
  primitiveCallId: primitiveResult.primitiveCallId,
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

export async function runMouseClickPrimitiveStage(
  input: MouseClickExecutorInput,
  state: MouseClickPreflightState,
) {
  const primitiveResult = await runPrimitiveClick({
    context: input.context,
    attemptRef: state.seed.attemptRef,
    actionExecutionRef: state.reservation.actionExecutionRef,
    idempotencyKey: state.reservation.idempotencyKey,
    sessionId: state.seed.sessionId,
    roundId: state.seed.roundId,
    videoVisitId: state.seed.videoVisitId,
    geometryGuardProofRef: state.seed.geometryGuardProofRef ?? state.seed.sourceCoordinateProofRef ?? state.seed.inputRef,
    sourceCoordinateProofRef: state.seed.sourceCoordinateProofRef ?? state.seed.inputRef,
    sourceTargetRef: state.seed.sourceTargetRef ?? state.seed.inputRef,
    operatorApprovalRef: state.seed.safetyPolicy.desktopScreenOperatorApprovalRef,
    targetLabel: `${state.seed.purpose}:${state.seed.childCapabilityId}`,
    coordinateSpace: input.expectedCoordinateSpace,
    executableCoordinate: state.safetyGate.executableCoordinate,
    button: state.seed.button,
    clickCount: state.seed.clickCount,
    timeoutMs: state.seed.timeoutMs,
    maxDurationMs: state.seed.safetyPolicy.maxDurationMs,
  });

  return primitiveResult.ok
    ? buildPrimitiveSuccessResult(state, primitiveResult)
    : buildPrimitiveFailureResult(state, primitiveResult);
}