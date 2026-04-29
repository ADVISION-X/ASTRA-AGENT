import type { PageStateAbilityInput } from "../schema.js";
import { childRequiresObservationSupport } from "../shared/page-state-policy.js";
import type { PageStateGateFailure } from "../shared/page-state-types.js";

export function gatePageStateInput(request: PageStateAbilityInput): { ok: true; inputDecision: "allow" } | { ok: false; inputDecision: "fail"; failure: PageStateGateFailure } {
  if (!request.snapshot.sourceProofRef) {
    return {
      ok: false,
      inputDecision: "fail",
      failure: {
        status: "failed",
        decision: "fail",
        failureReason: "missing_snapshot_proof",
        stateSummary: "Page State input is missing snapshot proof binding.",
        reviewRequiredReason: null,
        pageStateType: "unknown_page",
        confidence: 0,
        dataQualityFlags: ["insufficient_signal"],
      },
    };
  }

  if (!request.openHandoff.openProofRef || !request.openHandoff.browserSessionRef) {
    return {
      ok: false,
      inputDecision: "fail",
      failure: {
        status: "failed",
        decision: "fail",
        failureReason: "missing_open_handoff",
        stateSummary: "Page State input is missing the open handoff binding.",
        reviewRequiredReason: null,
        pageStateType: "unknown_page",
        confidence: 0,
        dataQualityFlags: ["insufficient_signal"],
      },
    };
  }

  if (childRequiresObservationSupport(request.childCapabilityId) && request.observations.length === 0) {
    return {
      ok: false,
      inputDecision: "fail",
      failure: {
        status: "failed",
        decision: "fail",
        failureReason: "missing_observation_support",
        stateSummary: `Page State child ${request.childCapabilityId} requires governed observations.`,
        reviewRequiredReason: null,
        pageStateType: "unknown_page",
        confidence: 0,
        dataQualityFlags: ["missing_observation", "insufficient_signal"],
      },
    };
  }

  return { ok: true, inputDecision: "allow" };
}