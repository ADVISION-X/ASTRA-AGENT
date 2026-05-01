import type { MouseClickAbilityContext, MouseClickChildCapabilityId } from "../contract.js";
import { buildMouseClickResult } from "./mouse-click-result-builder.js";
import { resolveMouseClickFailureSeed } from "./mouse-click-input-gate.js";
import { buildStableMouseClickRef } from "../shared/mouse-click-types.js";

const buildFailureSeed = (input: Parameters<typeof dispatchMouseClickFailure>[0]) => {
  const seed = resolveMouseClickFailureSeed(input.rawInput, input.childCapabilityId);
  return {
    ...seed,
    childCapabilityId: input.childCapabilityId ?? seed.childCapabilityId,
    coordinateSpace: input.childCapabilityId === "click-desktop-coordinate" ? "desktopScreen" : seed.coordinateSpace,
  };
};

const buildFailureClock = (context: MouseClickAbilityContext) => {
  const startedSnapshot = context.clock.now();
  const endedSnapshot = context.clock.now();
  return {
    startedAt: startedSnapshot.isoTimestamp,
    endedAt: endedSnapshot.isoTimestamp,
    durationMs: Math.max(0, Math.round(endedSnapshot.monotonicMs - startedSnapshot.monotonicMs)),
    clock: { startedMonotonicMs: startedSnapshot.monotonicMs, endedMonotonicMs: endedSnapshot.monotonicMs },
  };
};

const buildFailureResultInput = (input: Parameters<typeof dispatchMouseClickFailure>[0], seed: ReturnType<typeof buildFailureSeed>, rejectionRef: string) => ({
  seed,
  idempotencyKey: null,
  idempotencyDecision: null,
  actionExecutionRef: null,
  rejectionRef,
  status: "failed" as const,
  failureReason: input.failureReason,
  reviewRequiredReason: null,
  statusMessage: input.statusMessage,
  preActionDecision: "blocked" as const,
  requestedCoordinate: seed.requestedCoordinate,
  executableCoordinate: null,
  primitiveExecutionRef: null,
  policyDecisionReason: input.failureReason,
  policyDecision: "block" as const,
  geometryDecision: "block" as const,
  safetyDecision: "block" as const,
  safetyDecisionReason: input.failureReason,
  coordinateRoundingDecision: null,
  primitiveDecision: "not_run" as const,
  primitiveCallId: null,
  primitiveTimeoutMs: 0,
  maxDurationMs: 0,
  timeoutDecision: "within_limit" as const,
  abortDecision: "not_requested" as const,
  circuitBreakerState: "closed" as const,
  clickSuppressedReason: input.failureReason,
  primitivePortKind: "not-run",
  primitiveStartedAt: null,
  primitiveEndedAt: null,
  ...buildFailureClock(input.context),
  dataQualityFlags: [input.failureReason],
});

export function dispatchMouseClickFailure(input: {
  rawInput: unknown;
  context: MouseClickAbilityContext;
  childCapabilityId?: MouseClickChildCapabilityId;
  failureReason: "input_schema_invalid" | "unknown_child_capability" | "child_execution_failed";
  statusMessage: string;
}) {
  const seed = buildFailureSeed(input);
  const rejectionRef = buildStableMouseClickRef("mouse-click-rejection", [seed.attemptRef, input.failureReason]);
  return buildMouseClickResult(buildFailureResultInput(input, seed, rejectionRef));
}