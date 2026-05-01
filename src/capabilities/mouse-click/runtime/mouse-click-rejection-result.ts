import type { MouseClickAbilityContext } from "../contract.js";
import { buildMouseClickExecutionSeed } from "./mouse-click-input-gate.js";
import { buildMouseClickResult } from "./mouse-click-result-builder.js";

type MouseClickRejectionInput = {
  seed: ReturnType<typeof buildMouseClickExecutionSeed>;
  context: MouseClickAbilityContext;
  idempotencyKey: string | null;
  idempotencyDecision: "reserved" | "duplicate_review_required" | "cooldown_blocked" | null;
  actionExecutionRef: string | null;
  rejectionRef: string;
  status: "failed" | "review_required";
  failureReason: string | null;
  reviewRequiredReason: string | null;
  statusMessage: string;
  preActionDecision: "blocked" | "review_required";
  requestedCoordinate: { x: number; y: number } | null;
  policyDecision: "allow" | "block" | "review_required" | "duplicate_review_required";
  policyDecisionReason: string | null;
  geometryDecision: "allow" | "block";
  safetyDecision: "allow" | "block";
  safetyDecisionReason: string | null;
  coordinateRoundingDecision: string | null;
  clickSuppressedReason: string | null;
  dataQualityFlags: string[];
};

const buildRejectedClockFrame = (context: MouseClickAbilityContext) => {
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

const buildRejectedOutcomeFields = (input: MouseClickRejectionInput) => ({
  status: input.status,
  failureReason: input.failureReason,
  reviewRequiredReason: input.reviewRequiredReason,
  statusMessage: input.statusMessage,
  preActionDecision: input.preActionDecision,
  requestedCoordinate: input.requestedCoordinate,
  executableCoordinate: null,
  primitiveExecutionRef: null,
  policyDecision: input.policyDecision,
  policyDecisionReason: input.policyDecisionReason,
  geometryDecision: input.geometryDecision,
  safetyDecision: input.safetyDecision,
  safetyDecisionReason: input.safetyDecisionReason,
  coordinateRoundingDecision: input.coordinateRoundingDecision,
  primitiveDecision: "not_run" as const,
  primitiveCallId: null,
  clickSuppressedReason: input.clickSuppressedReason,
  primitivePortKind: "not-run",
  primitiveStartedAt: null,
  primitiveEndedAt: null,
  dataQualityFlags: input.dataQualityFlags,
});

export function buildRejectedMouseClickResult(input: MouseClickRejectionInput) {
  return buildMouseClickResult({
    seed: input.seed,
    idempotencyKey: input.idempotencyKey,
    idempotencyDecision: input.idempotencyDecision,
    actionExecutionRef: input.actionExecutionRef,
    rejectionRef: input.rejectionRef,
    primitiveTimeoutMs: input.seed.safetyPolicy.primitiveTimeoutMs,
    maxDurationMs: input.seed.safetyPolicy.maxDurationMs,
    timeoutDecision: "within_limit",
    abortDecision: "not_requested",
    circuitBreakerState: "closed",
    ...buildRejectedOutcomeFields(input),
    ...buildRejectedClockFrame(input.context),
  });
}