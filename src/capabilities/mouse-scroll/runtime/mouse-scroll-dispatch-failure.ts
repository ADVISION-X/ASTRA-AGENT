import type { MouseScrollChildCapabilityId } from "../contract.js";
import { buildMouseScrollResult } from "./mouse-scroll-result-builder.js";
import { resolveMouseScrollFailureSeed } from "./mouse-scroll-input-gate.js";
import { buildStableMouseScrollRef } from "../shared/mouse-scroll-types.js";
import type { MouseScrollExecutionContext } from "./mouse-scroll-runtime-context.js";

type DispatchMouseScrollFailureInput = {
  rawInput: unknown;
  context: MouseScrollExecutionContext;
  childCapabilityId?: MouseScrollChildCapabilityId;
  failureReason: "input_schema_invalid" | "unknown_child_capability" | "child_execution_failed";
  statusMessage: string;
};

const resolveDispatchFailureSeed = (input: DispatchMouseScrollFailureInput) => {
  const seed = resolveMouseScrollFailureSeed(input.rawInput, input.childCapabilityId);
  const childCapabilityId = input.childCapabilityId ?? seed.childCapabilityId;

  return {
    ...seed,
    childCapabilityId,
    coordinateSpace: childCapabilityId === "scroll-desktop-screen" ? "desktopScreen" : seed.coordinateSpace,
  };
};

const sampleDispatchFailureTiming = (context: MouseScrollExecutionContext) => {
  const startedSnapshot = context.clock.now();
  const endedSnapshot = context.clock.now();

  return {
    startedAt: startedSnapshot.isoTimestamp,
    endedAt: endedSnapshot.isoTimestamp,
    durationMs: Math.max(0, Math.round(endedSnapshot.monotonicMs - startedSnapshot.monotonicMs)),
    clock: {
      startedMonotonicMs: startedSnapshot.monotonicMs,
      endedMonotonicMs: endedSnapshot.monotonicMs,
    },
  };
};

const buildDispatchFailureDecisionFields = () => ({
  policyDecision: "block" as const,
  policyDecisionReason: "dispatch_failure",
  geometryDecision: "block" as const,
  geometryDecisionReason: "dispatch_failure",
  safetyDecision: "block" as const,
  safetyDecisionReason: "dispatch_failure",
  primitiveDecision: "not_run" as const,
  deltaResolutionDecision: null,
  deltaCapDecision: null,
  idempotencyDecision: null,
});

const buildDispatchFailurePrimitiveFields = (primitiveTimeoutMs: number, maxDurationMs: number) => ({
  primitiveCallId: null,
  primitiveStartedAt: null,
  primitiveEndedAt: null,
  primitivePortKind: "browser-controller" as const,
  timeoutDecision: "within_limit" as const,
  abortDecision: "not_requested" as const,
  circuitBreakerState: "closed" as const,
  portHangDetected: false,
  perIterationPrimitiveProofs: [],
  primitiveTimeoutMs,
  maxDurationMs,
});

export function dispatchMouseScrollFailure(input: DispatchMouseScrollFailureInput) {
  const seed = resolveDispatchFailureSeed(input);
  const timing = sampleDispatchFailureTiming(input.context);
  const rejectionRef = buildStableMouseScrollRef("mouse-scroll-rejection", [seed.attemptRef, input.failureReason]);

  return buildMouseScrollResult({
    seed,
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
    ...buildDispatchFailureDecisionFields(),
    ...timing,
    ...buildDispatchFailurePrimitiveFields(seed.safetyPolicy.primitiveTimeoutMs, seed.safetyPolicy.maxDurationMs),
    dataQualityFlags: [input.failureReason],
  });
}