import type { MouseScrollChildCapabilityId } from "../contract.js";
import { buildMouseScrollResult } from "./mouse-scroll-result-builder.js";
import { resolveMouseScrollFailureSeed } from "./mouse-scroll-input-gate.js";
import { buildStableMouseScrollRef } from "../shared/mouse-scroll-types.js";
import type { MouseScrollExecutionContext } from "./mouse-scroll-runtime-context.js";

export function dispatchMouseScrollFailure(input: {
  rawInput: unknown;
  context: MouseScrollExecutionContext;
  childCapabilityId?: MouseScrollChildCapabilityId;
  failureReason: "input_schema_invalid" | "unknown_child_capability" | "child_execution_failed";
  statusMessage: string;
}) {
  const seed = resolveMouseScrollFailureSeed(input.rawInput, input.childCapabilityId);
  const startedSnapshot = input.context.clock.now();
  const endedSnapshot = input.context.clock.now();
  const rejectionRef = buildStableMouseScrollRef("mouse-scroll-rejection", [seed.attemptRef, input.failureReason]);

  return buildMouseScrollResult({
    seed: {
      ...seed,
      childCapabilityId: input.childCapabilityId ?? seed.childCapabilityId,
      coordinateSpace: (input.childCapabilityId ?? seed.childCapabilityId) === "scroll-desktop-screen" ? "desktopScreen" : seed.coordinateSpace,
    },
    idempotencyKey: null,
    scrollExecutionRef: null,
    rejectionRef,
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
    policyDecisionReason: "dispatch_failure",
    geometryDecision: "block",
    geometryDecisionReason: "dispatch_failure",
    safetyDecision: "block",
    safetyDecisionReason: "dispatch_failure",
    primitiveDecision: "not_run",
    deltaResolutionDecision: null,
    deltaCapDecision: null,
    idempotencyDecision: null,
    startedAt: startedSnapshot.isoTimestamp,
    endedAt: endedSnapshot.isoTimestamp,
    durationMs: Math.max(0, Math.round(endedSnapshot.monotonicMs - startedSnapshot.monotonicMs)),
    clock: { startedMonotonicMs: startedSnapshot.monotonicMs, endedMonotonicMs: endedSnapshot.monotonicMs },
    primitiveCallId: null,
    primitiveStartedAt: null,
    primitiveEndedAt: null,
    primitivePortKind: "browser-controller",
    timeoutDecision: "within_limit",
    abortDecision: "not_requested",
    circuitBreakerState: "closed",
    portHangDetected: false,
    perIterationPrimitiveProofs: [],
    primitiveTimeoutMs: seed.safetyPolicy.primitiveTimeoutMs,
    maxDurationMs: seed.safetyPolicy.maxDurationMs,
    dataQualityFlags: [input.failureReason],
  });
}