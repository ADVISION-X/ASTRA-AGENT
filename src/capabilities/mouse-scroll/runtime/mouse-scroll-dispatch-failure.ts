import type { MouseScrollAbilityContext, MouseScrollChildCapabilityId } from "../contract.js";
import { buildMouseScrollResult } from "./mouse-scroll-result-builder.js";
import { coerceMouseScrollFailureSeed } from "./mouse-scroll-input-gate.js";
import { buildStableMouseScrollRef } from "../shared/mouse-scroll-types.js";

export function dispatchMouseScrollFailure(input: {
  rawInput: unknown;
  context: MouseScrollAbilityContext;
  childCapabilityId?: MouseScrollChildCapabilityId;
  failureReason: "input_schema_invalid" | "unknown_child_capability" | "child_execution_failed";
  statusMessage: string;
}) {
  const seed = coerceMouseScrollFailureSeed(input.rawInput);
  const startedSnapshot = input.context.clock.now();
  const endedSnapshot = input.context.clock.now();
  const resolvedChild = input.childCapabilityId ?? seed.childCapabilityId;
  const idempotencyKey = buildStableMouseScrollRef("mouse-scroll-dispatch", [seed.sessionId, resolvedChild, input.failureReason]);

  return buildMouseScrollResult({
    seed: {
      ...seed,
      childCapabilityId: resolvedChild,
      coordinateSpace: resolvedChild === "scroll-desktop-screen" ? "desktopScreen" : seed.coordinateSpace,
    },
    idempotencyKey,
    scrollExecutionRef: buildStableMouseScrollRef("mouse-scroll-action", [idempotencyKey]),
    status: "failed",
    failureReason: input.failureReason,
    reviewRequiredReason: null,
    statusMessage: input.statusMessage,
    requestedDelta: null,
    executableDelta: null,
    requestedAnchor: seed.requestedAnchor,
    executableAnchor: null,
    primitiveExecutionRefs: [],
    policyDecision: "block",
    geometryDecision: "block",
    primitiveDecision: "not_run",
    startedAt: startedSnapshot.isoTimestamp,
    endedAt: endedSnapshot.isoTimestamp,
    durationMs: Math.max(0, Math.round(endedSnapshot.monotonicMs - startedSnapshot.monotonicMs)),
    clock: { startedMonotonicMs: startedSnapshot.monotonicMs, endedMonotonicMs: endedSnapshot.monotonicMs },
    dataQualityFlags: [input.failureReason],
  });
}