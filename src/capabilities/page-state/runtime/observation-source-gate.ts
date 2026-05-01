import type { PageStateAbilityInput, PageStateFailureReason, PageStateObservation } from "../schema.js";
import { childRequiresObservationSupport } from "../shared/page-state-policy.js";
import type { PageStateGateFailure } from "../shared/page-state-types.js";

const ALLOWED_OBSERVATION_SOURCES: Record<PageStateObservation["kind"], readonly PageStateObservation["sourceAbilityGroupId"][]> = {
  runtime_signal: ["runtime-signal", "post-action-verification"],
  page_marker: ["runtime-signal", "screenshot", "open"],
  visual_target: ["visual-target"],
  platform_capture: ["screenshot", "open", "runtime-signal"],
  post_action_verification: ["post-action-verification"],
};

function resolveObservationSourceFailure(request: PageStateAbilityInput): { decision: "review_required" | "fail"; stateSummary: string; failureReason: PageStateFailureReason } | null {
  const mismatchedObservation = request.observations.find(
    (observation) => !ALLOWED_OBSERVATION_SOURCES[observation.kind].includes(observation.sourceAbilityGroupId),
  );

  if (mismatchedObservation) {
    return {
      decision: "fail",
      failureReason: "observation_source_forbidden",
      stateSummary: `Observation ${mismatchedObservation.observationId} uses a forbidden source for ${mismatchedObservation.kind}.`,
    };
  }

  if (childRequiresObservationSupport(request.childCapabilityId) && request.observations.length === 0) {
    return {
      decision: "review_required",
      failureReason: "missing_observation_support",
      stateSummary: `Page State child ${request.childCapabilityId} needs a governed observation source.`,
    };
  }

  if (request.snapshot.sourceProofRef !== request.openHandoff.openProofRef && request.snapshot.sourceAbilityGroupId === "open") {
    return {
      decision: "review_required",
      failureReason: "observation_source_mismatch",
      stateSummary: "Page State snapshot source proof does not match the open handoff proof.",
    };
  }

  return null;
}

function createObservationSourceFailure(decision: "review_required" | "fail", failureReason: PageStateFailureReason, stateSummary: string): { ok: false; sourceDecision: "review_required" | "fail"; failure: PageStateGateFailure } {
  return {
    ok: false,
    sourceDecision: decision,
    failure: {
      status: decision === "fail" ? "failed" : "review_required",
      decision,
      failureReason,
      stateSummary,
      reviewRequiredReason: decision === "fail" ? null : stateSummary,
      pageStateType: "unknown_page",
      confidence: 0,
      dataQualityFlags: decision === "fail" ? ["source_mismatch"] : ["missing_observation", "source_mismatch"],
    },
  };
}

export function gateObservationSources(request: PageStateAbilityInput):
  | { ok: true; sourceDecision: "allow" }
  | { ok: false; sourceDecision: "review_required" | "fail"; failure: PageStateGateFailure } {
  const failure = resolveObservationSourceFailure(request);
  if (failure) {
    return createObservationSourceFailure(failure.decision, failure.failureReason, failure.stateSummary);
  }

  return { ok: true, sourceDecision: "allow" };
}