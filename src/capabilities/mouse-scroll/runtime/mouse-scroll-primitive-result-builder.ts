import { buildMouseScrollResult } from "./mouse-scroll-result-builder.js";
import { runPrimitiveScroll } from "./primitive-scroll-runner.js";
import type { ReservedMouseScrollExecution } from "./mouse-scroll-execution-stage-types.js";

type MouseScrollPrimitiveResult = Awaited<ReturnType<typeof runPrimitiveScroll>>;

const buildPrimitivePortFields = (primitiveResult: Extract<MouseScrollPrimitiveResult, { ok: boolean }>) => ({
  startedAt: primitiveResult.startedAt,
  endedAt: primitiveResult.endedAt,
  durationMs: primitiveResult.durationMs,
  clock: primitiveResult.clock,
  primitiveCallId: primitiveResult.primitiveCallId,
  primitiveStartedAt: primitiveResult.primitiveStartedAt,
  primitiveEndedAt: primitiveResult.primitiveEndedAt,
  primitivePortKind: primitiveResult.primitivePortKind,
  timeoutDecision: primitiveResult.timeoutDecision,
  abortDecision: primitiveResult.abortDecision,
  circuitBreakerState: primitiveResult.circuitBreakerState,
  portHangDetected: primitiveResult.portHangDetected,
  perIterationPrimitiveProofs: primitiveResult.perIterationPrimitiveProofs,
});

const buildPrimitiveOutcomeBase = (
  reserved: ReservedMouseScrollExecution,
  primitiveResult: Extract<MouseScrollPrimitiveResult, { ok: boolean }>,
) => ({
  seed: reserved.seed,
  idempotencyKey: reserved.reservation.idempotencyKey,
  scrollExecutionRef: reserved.reservation.scrollExecutionRef,
  rejectionRef: null,
  statusMessage: primitiveResult.statusMessage,
  requestedDelta: reserved.deltaResolution.requestedDelta,
  requestedAnchor: reserved.safetyGate.requestedAnchor,
  primitiveExecutionRefs: primitiveResult.primitiveExecutionRefs,
  policyDecision: "allow" as const,
  policyDecisionReason: reserved.policyGate.policyDecisionReason,
  geometryDecision: "allow" as const,
  geometryDecisionReason: reserved.geometryGate.geometryDecisionReason,
  safetyDecision: reserved.safetyGate.safetyDecision,
  safetyDecisionReason: reserved.safetyGate.safetyDecisionReason,
  primitiveDecision: primitiveResult.primitiveDecision,
  deltaResolutionDecision: reserved.deltaResolution.deltaResolutionDecision,
  deltaCapDecision: reserved.deltaResolution.deltaCapDecision,
  idempotencyDecision: reserved.reservation.idempotencyDecision,
  ...buildPrimitivePortFields(primitiveResult),
  primitiveTimeoutMs: reserved.seed.safetyPolicy.primitiveTimeoutMs,
  maxDurationMs: reserved.seed.safetyPolicy.maxDurationMs,
});

export function buildPrimitiveFailureResult(
  reserved: ReservedMouseScrollExecution,
  primitiveResult: Extract<MouseScrollPrimitiveResult, { ok: false }>,
) {
  return buildMouseScrollResult({
    ...buildPrimitiveOutcomeBase(reserved, primitiveResult),
    status: "failed",
    failureReason: primitiveResult.failureReason,
    reviewRequiredReason: null,
    executableDelta: null,
    executableAnchor: null,
    dataQualityFlags: primitiveResult.dataQualityFlags,
  });
}

export function buildPrimitiveSuccessResult(
  reserved: ReservedMouseScrollExecution,
  primitiveResult: Extract<MouseScrollPrimitiveResult, { ok: true }>,
) {
  return buildMouseScrollResult({
    ...buildPrimitiveOutcomeBase(reserved, primitiveResult),
    status: "success",
    failureReason: null,
    reviewRequiredReason: null,
    executableDelta: reserved.deltaResolution.executableDelta,
    executableAnchor: reserved.safetyGate.executableAnchor,
    dataQualityFlags: reserved.deltaResolution.dataQualityFlags,
  });
}