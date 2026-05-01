import type { PageStateAbilityInput, PageStateFailureReason } from "../schema.js";
import { childRequiresObservationSupport } from "../shared/page-state-policy.js";
import type { PageStateGateFailure } from "../shared/page-state-types.js";

function resolvePageStateInputFailure(request: PageStateAbilityInput): { failureReason: PageStateFailureReason; stateSummary: string } | null {
  if (!request.snapshot.sourceProofRef) {
    return {
      failureReason: "missing_snapshot_proof",
      stateSummary: "Page State input is missing snapshot proof binding.",
    };
  }

  if (!request.openHandoff.openProofRef || !request.openHandoff.browserSessionRef) {
    return {
      failureReason: "missing_open_handoff",
      stateSummary: "Page State input is missing the open handoff binding.",
    };
  }

  if (childRequiresObservationSupport(request.childCapabilityId) && request.observations.length === 0) {
    return {
      failureReason: "missing_observation_support",
      stateSummary: `Page State child ${request.childCapabilityId} requires governed observations.`,
    };
  }

  return null;
}

function createPageStateInputFailure(failureReason: PageStateFailureReason, stateSummary: string): { ok: false; inputDecision: "fail"; failure: PageStateGateFailure } {
  return {
    ok: false,
    inputDecision: "fail",
    failure: {
      status: "failed",
      decision: "fail",
      failureReason,
      stateSummary,
      reviewRequiredReason: null,
      pageStateType: "unknown_page",
      confidence: 0,
      dataQualityFlags: ["insufficient_signal"],
    },
  };
}

export function gatePageStateInput(request: PageStateAbilityInput): { ok: true; inputDecision: "allow" } | { ok: false; inputDecision: "fail"; failure: PageStateGateFailure } {
  const failure = resolvePageStateInputFailure(request);
  if (failure) {
    return createPageStateInputFailure(failure.failureReason, failure.stateSummary);
  }

  return { ok: true, inputDecision: "allow" };
}