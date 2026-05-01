import type { PageStateChildCapability } from "./page-state-child-contract.js";
import type { PageStateAbilityInput } from "../schema.js";
import type { PageStateClockReading, PageStateExecutionTrace } from "../shared/page-state-types.js";
import { createPageStateFingerprint } from "./page-state-fingerprint.js";
import { buildPageStateRuntimeProof } from "./page-state-proof-builder.js";
import { buildPageStateResult } from "./page-state-result-builder.js";
import { decideProceed } from "./proceed-decision-gate.js";
import { classifyPageState } from "./state-classification-gate.js";
import type { PageStatePreflightState } from "./page-state-preflight.js";

function resolveObservationRefs(input: {
  request: PageStateAbilityInput;
  matchedObservationIds: readonly string[];
}) {
  return [...new Set([...input.request.observations.map((observation) => observation.observationId), ...input.matchedObservationIds])];
}

function resolveOutputBoundaryDecision(input: Awaited<ReturnType<typeof classifyPageState>>): PageStateExecutionTrace["outputBoundaryDecision"] {
  return input.status === "success"
    ? "allow"
    : input.failureReason === "output_boundary_violation"
      ? "fail"
      : "review_required";
}

function resolveCriticalDataQualityDecision(input: Awaited<ReturnType<typeof classifyPageState>>): PageStateExecutionTrace["criticalDataQualityDecision"] {
  return input.status === "success"
    ? "allow"
    : input.failureReason === "low_confidence" || input.failureReason === "insufficient_signal"
      ? "review_required"
      : "allow";
}

function buildClassificationTrace(input: {
  preflight: PageStatePreflightState;
  outcome: Awaited<ReturnType<typeof classifyPageState>>;
}): PageStateExecutionTrace {
  const classificationDecision: PageStateExecutionTrace["classificationDecision"] = input.outcome.decision === "proceed"
    ? "proceed"
    : input.outcome.decision === "review_required"
      ? "review_required"
      : input.outcome.decision === "block"
        ? "block"
        : "fail";

  return {
    inputDecision: input.preflight.inputGate.inputDecision,
    sourceDecision: input.preflight.sourceGate.sourceDecision,
    payloadBudgetDecision: input.preflight.payloadBudgetGate.payloadBudgetDecision,
    observationBindingDecision: input.preflight.proofBindingGate.observationBindingDecision,
    freshnessDecision: input.preflight.freshnessGate.freshnessDecision,
    platformDecision: input.preflight.platformGate.platformDecision,
    classificationDecision,
    outputBoundaryDecision: resolveOutputBoundaryDecision(input.outcome),
    criticalDataQualityDecision: resolveCriticalDataQualityDecision(input.outcome),
    proceedDecision: input.outcome.decision,
  };
}

async function classifyWithProceedDecision(input: {
  request: PageStateAbilityInput;
  childCapability: PageStateChildCapability;
  preflight: PageStatePreflightState;
}) {
  const classified = await classifyPageState({
    request: input.request,
    childCapability: input.childCapability,
    resolvedProfile: input.preflight.platformGate.profile,
  });

  return decideProceed(classified);
}

export async function buildPageStateSuccessResult(input: {
  request: PageStateAbilityInput;
  childCapability: PageStateChildCapability;
  startedAt: PageStateClockReading;
  clock: { now(): PageStateClockReading };
  preflight: PageStatePreflightState;
}) {
  const outcome = await classifyWithProceedDecision(input);
  const endedAt = input.clock.now();
  const observationRefs = resolveObservationRefs({ request: input.request, matchedObservationIds: outcome.matchedObservationIds });
  const pageStateFingerprint = createPageStateFingerprint({
    request: input.request,
    pageStateType: outcome.pageStateType,
    observationRefs,
  });
  const runtimeProof = buildPageStateRuntimeProof({
    request: input.request,
    timing: { startedAt: input.startedAt, endedAt },
    trace: buildClassificationTrace({ preflight: input.preflight, outcome }),
    status: outcome.status,
    decision: outcome.decision,
    pageStateType: outcome.pageStateType,
    confidence: outcome.confidence,
    failureReason: outcome.failureReason,
    reviewRequiredReason: outcome.reviewRequiredReason,
    pageStateFingerprint,
    observationRefs,
    dataQualityFlags: outcome.dataQualityFlags,
    resolvedPlatformProfileId: outcome.resolvedProfileId,
    matchedHost: outcome.matchedHost,
  });

  return buildPageStateResult({
    request: input.request,
    outcome,
    runtimeProof,
    observationRefs,
    pageStateFingerprint,
  });
}