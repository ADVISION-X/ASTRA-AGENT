import { buildMouseScrollResult } from "./mouse-scroll-result-builder.js";
import type { ValidatedMouseScrollExecution } from "./mouse-scroll-execution-stage-types.js";
import type { BlockedResultInput } from "./mouse-scroll-blocked-result-types.js";
import type { MouseScrollExecutionContext } from "./mouse-scroll-runtime-context.js";

const buildBlockedTiming = (context: MouseScrollExecutionContext) => {
  const startedSnapshot = context.clock.now();
  const endedSnapshot = context.clock.now();

  return {
    startedAt: startedSnapshot.isoTimestamp,
    endedAt: endedSnapshot.isoTimestamp,
    durationMs: Math.max(0, Math.round(endedSnapshot.monotonicMs - startedSnapshot.monotonicMs)),
    clock: { startedMonotonicMs: startedSnapshot.monotonicMs, endedMonotonicMs: endedSnapshot.monotonicMs },
  };
};

const buildBlockedPrimitiveFields = (primitiveTimeoutMs: number, maxDurationMs: number) => ({
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

export function buildBlockedResult(input: BlockedResultInput) {
  return buildMouseScrollResult({
    seed: input.seed,
    idempotencyKey: null,
    scrollExecutionRef: null,
    rejectionRef: `blocked:${input.seed.attemptRef}:${input.failureReason}`,
    status: input.status,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    statusMessage: input.statusMessage,
    requestedDelta: null,
    executableDelta: null,
    requestedAnchor: input.seed.requestedAnchor,
    executableAnchor: null,
    primitiveExecutionRefs: [],
    policyDecision: input.policyDecision,
    policyDecisionReason: input.policyDecisionReason,
    geometryDecision: input.geometryDecision,
    geometryDecisionReason: input.geometryDecisionReason,
    safetyDecision: input.safetyDecision,
    safetyDecisionReason: input.safetyDecisionReason,
    primitiveDecision: "not_run",
    deltaResolutionDecision: null,
    deltaCapDecision: null,
    idempotencyDecision: null,
    ...buildBlockedTiming(input.context),
    ...buildBlockedPrimitiveFields(input.seed.safetyPolicy.primitiveTimeoutMs, input.seed.safetyPolicy.maxDurationMs),
    dataQualityFlags: input.dataQualityFlags,
  });
}

export function buildReservationRejectedResult(
  validated: ValidatedMouseScrollExecution,
  reservation: ReturnType<MouseScrollExecutionContext["idempotency"]["reserve"]> & { ok: false },
  context: MouseScrollExecutionContext,
) {
  const blockedSnapshot = context.clock.now();
  return buildMouseScrollResult({
    seed: validated.seed,
    idempotencyKey: reservation.idempotencyKey,
    scrollExecutionRef: reservation.scrollExecutionRef,
    rejectionRef: reservation.rejectionRef,
    status: reservation.status,
    failureReason: reservation.failureReason,
    reviewRequiredReason: reservation.reviewRequiredReason,
    statusMessage: reservation.statusMessage,
    requestedDelta: validated.deltaResolution.requestedDelta,
    executableDelta: null,
    requestedAnchor: validated.safetyGate.requestedAnchor,
    executableAnchor: null,
    primitiveExecutionRefs: [],
    policyDecision: reservation.policyDecision,
    policyDecisionReason: reservation.idempotencyDecision,
    geometryDecision: "allow",
    geometryDecisionReason: validated.geometryGate.geometryDecisionReason,
    safetyDecision: validated.safetyGate.safetyDecision,
    safetyDecisionReason: validated.safetyGate.safetyDecisionReason,
    primitiveDecision: "not_run",
    deltaResolutionDecision: validated.deltaResolution.deltaResolutionDecision,
    deltaCapDecision: validated.deltaResolution.deltaCapDecision,
    idempotencyDecision: reservation.idempotencyDecision,
    startedAt: blockedSnapshot.isoTimestamp,
    endedAt: blockedSnapshot.isoTimestamp,
    durationMs: 0,
    clock: { startedMonotonicMs: blockedSnapshot.monotonicMs, endedMonotonicMs: blockedSnapshot.monotonicMs },
    ...buildBlockedPrimitiveFields(validated.seed.safetyPolicy.primitiveTimeoutMs, validated.seed.safetyPolicy.maxDurationMs),
    dataQualityFlags: reservation.dataQualityFlags,
  });
}
