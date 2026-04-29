import type { MouseClickAbilityContext, MouseClickChildCapabilityId } from "../contract.js";
import { buildMouseClickResult } from "./mouse-click-result-builder.js";
import { coerceMouseClickFailureSeed } from "./mouse-click-input-gate.js";
import { buildStableMouseClickRef } from "../shared/mouse-click-types.js";

export function dispatchMouseClickFailure(input: {
  rawInput: unknown;
  context: MouseClickAbilityContext;
  childCapabilityId?: MouseClickChildCapabilityId;
  failureReason: "input_schema_invalid" | "unknown_child_capability" | "child_execution_failed";
  statusMessage: string;
}) {
  const seed = coerceMouseClickFailureSeed(input.rawInput);
  const startedSnapshot = input.context.clock.now();
  const endedSnapshot = input.context.clock.now();
  const idempotencyKey = buildStableMouseClickRef("mouse-click-dispatch", [
    seed.sessionId,
    input.childCapabilityId ?? seed.childCapabilityId,
    input.failureReason,
  ]);
  return buildMouseClickResult({
    seed: {
      ...seed,
      childCapabilityId: input.childCapabilityId ?? seed.childCapabilityId,
      coordinateSpace: input.childCapabilityId === "click-desktop-coordinate" ? "desktopScreen" : seed.coordinateSpace,
    },
    idempotencyKey,
    actionExecutionRef: buildStableMouseClickRef("mouse-click-action", [idempotencyKey]),
    status: "failed",
    failureReason: input.failureReason,
    reviewRequiredReason: null,
    statusMessage: input.statusMessage,
    requestedCoordinate: seed.requestedCoordinate,
    executableCoordinate: null,
    primitiveExecutionRef: null,
    policyDecision: "block",
    geometryDecision: input.failureReason === "input_schema_invalid" ? "block" : "review_required",
    primitiveDecision: "not_run",
    startedAt: startedSnapshot.isoTimestamp,
    endedAt: endedSnapshot.isoTimestamp,
    durationMs: Math.max(0, Math.round(endedSnapshot.monotonicMs - startedSnapshot.monotonicMs)),
    clock: { startedMonotonicMs: startedSnapshot.monotonicMs, endedMonotonicMs: endedSnapshot.monotonicMs },
    dataQualityFlags: [input.failureReason],
  });
}