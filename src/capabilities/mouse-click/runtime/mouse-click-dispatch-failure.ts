import type { MouseClickAbilityContext, MouseClickChildCapabilityId } from "../contract.js";
import { buildMouseClickResult } from "./mouse-click-result-builder.js";
import { resolveMouseClickFailureSeed } from "./mouse-click-input-gate.js";
import { buildStableMouseClickRef } from "../shared/mouse-click-types.js";

export function dispatchMouseClickFailure(input: {
  rawInput: unknown;
  context: MouseClickAbilityContext;
  childCapabilityId?: MouseClickChildCapabilityId;
  failureReason: "input_schema_invalid" | "unknown_child_capability" | "child_execution_failed";
  statusMessage: string;
}) {
  const seed = resolveMouseClickFailureSeed(input.rawInput, input.childCapabilityId);
  const startedSnapshot = input.context.clock.now();
  const endedSnapshot = input.context.clock.now();
  const rejectionRef = buildStableMouseClickRef("mouse-click-rejection", [
    seed.attemptRef,
    input.failureReason,
  ]);

  return buildMouseClickResult({
    seed: {
      ...seed,
      childCapabilityId: input.childCapabilityId ?? seed.childCapabilityId,
      coordinateSpace: input.childCapabilityId === "click-desktop-coordinate" ? "desktopScreen" : seed.coordinateSpace,
    },
    idempotencyKey: null,
    idempotencyDecision: null,
    actionExecutionRef: null,
    rejectionRef,
    status: "failed",
    failureReason: input.failureReason,
    reviewRequiredReason: null,
    statusMessage: input.statusMessage,
    preActionDecision: "blocked",
    requestedCoordinate: seed.requestedCoordinate,
    executableCoordinate: null,
    primitiveExecutionRef: null,
    policyDecisionReason: input.failureReason,
    policyDecision: "block",
    geometryDecision: "block",
    safetyDecision: "block",
    safetyDecisionReason: input.failureReason,
    coordinateRoundingDecision: null,
    primitiveDecision: "not_run",
    primitiveCallId: null,
    primitiveTimeoutMs: 0,
    maxDurationMs: 0,
    timeoutDecision: "within_limit",
    abortDecision: "not_requested",
    circuitBreakerState: "closed",
    clickSuppressedReason: input.failureReason,
    primitivePortKind: "not-run",
    primitiveStartedAt: null,
    primitiveEndedAt: null,
    startedAt: startedSnapshot.isoTimestamp,
    endedAt: endedSnapshot.isoTimestamp,
    durationMs: Math.max(0, Math.round(endedSnapshot.monotonicMs - startedSnapshot.monotonicMs)),
    clock: { startedMonotonicMs: startedSnapshot.monotonicMs, endedMonotonicMs: endedSnapshot.monotonicMs },
    dataQualityFlags: [input.failureReason],
  });
}