import type { PageStateAbilityInput, PageStateObservation } from "../schema.js";
import { childRequiresObservationSupport } from "../shared/page-state-policy.js";
import type { PageStateGateFailure } from "../shared/page-state-types.js";

const ALLOWED_OBSERVATION_SOURCES: Record<PageStateObservation["kind"], readonly PageStateObservation["sourceAbilityGroupId"][]> = {
  runtime_signal: ["runtime-signal", "post-action-verification"],
  page_marker: ["runtime-signal", "screenshot", "open"],
  visual_target: ["visual-target"],
  platform_capture: ["screenshot", "open", "runtime-signal"],
  post_action_verification: ["post-action-verification"],
};

export function gateObservationSources(request: PageStateAbilityInput):
  | { ok: true; sourceDecision: "allow" }
  | { ok: false; sourceDecision: "review_required" | "fail"; failure: PageStateGateFailure } {
  const mismatchedObservation = request.observations.find(
    (observation) => !ALLOWED_OBSERVATION_SOURCES[observation.kind].includes(observation.sourceAbilityGroupId),
  );

  if (mismatchedObservation) {
    return {
      ok: false,
      sourceDecision: "fail",
      failure: {
        status: "failed",
        decision: "fail",
        failureReason: "observation_source_forbidden",
        stateSummary: `Observation ${mismatchedObservation.observationId} uses a forbidden source for ${mismatchedObservation.kind}.`,
        reviewRequiredReason: null,
        pageStateType: "unknown_page",
        confidence: 0,
        dataQualityFlags: ["source_mismatch"],
      },
    };
  }

  if (childRequiresObservationSupport(request.childCapabilityId) && request.observations.length === 0) {
    return {
      ok: false,
      sourceDecision: "review_required",
      failure: {
        status: "review_required",
        decision: "review_required",
        failureReason: "missing_observation_support",
        stateSummary: `Page State child ${request.childCapabilityId} needs a governed observation source.`,
        reviewRequiredReason: "Review required because no governed observation source was supplied.",
        pageStateType: "unknown_page",
        confidence: 0,
        dataQualityFlags: ["missing_observation", "source_mismatch"],
      },
    };
  }

  if (request.snapshot.sourceProofRef !== request.openHandoff.openProofRef && request.snapshot.sourceAbilityGroupId === "open") {
    return {
      ok: false,
      sourceDecision: "review_required",
      failure: {
        status: "review_required",
        decision: "review_required",
        failureReason: "observation_source_mismatch",
        stateSummary: "Page State snapshot source proof does not match the open handoff proof.",
        reviewRequiredReason: "Review required because snapshot source proof and open handoff proof are inconsistent.",
        pageStateType: "unknown_page",
        confidence: 0,
        dataQualityFlags: ["source_mismatch"],
      },
    };
  }

  return { ok: true, sourceDecision: "allow" };
}