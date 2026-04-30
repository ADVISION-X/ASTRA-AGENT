import type { PageStateAbilityInput, PageStateChildDetection, PageStateDataQualityFlag } from "../schema.js";
import type { PageStateGateFailure } from "../shared/page-state-types.js";

const CRITICAL_FLAGS = new Set<PageStateDataQualityFlag>([
  "low_confidence",
  "missing_observation",
  "stale_snapshot",
  "stale_observation",
  "source_mismatch",
  "platform_mismatch",
  "insufficient_signal",
]);

export function gatePageStateOutputBoundary(input: {
  request: PageStateAbilityInput;
  detection: PageStateChildDetection;
}):
  | { ok: true; outputBoundaryDecision: "allow"; criticalDataQualityDecision: "allow" }
  | { ok: false; outputBoundaryDecision: "review_required" | "fail"; criticalDataQualityDecision: "review_required" | "fail"; failure: PageStateGateFailure } {
  if (input.detection.childCapabilityId !== input.request.childCapabilityId) {
    return createBoundaryFailure("fail", "Page State child output escaped its governed child capability id.", "output_boundary_violation");
  }

  const requestObservationIds = new Set(input.request.observations.map((observation) => observation.observationId));
  const invalidObservationId = input.detection.matchedObservationIds.find((observationId) => !requestObservationIds.has(observationId));
  if (invalidObservationId) {
    return createBoundaryFailure("fail", `Child output referenced unknown observation ${invalidObservationId}.`, "output_boundary_violation");
  }

  const requestEvidenceRefs = new Set(input.request.sourceEvidenceRefs);
  const invalidEvidenceRef = input.detection.supportingEvidenceRefs.find((evidenceRef) => !requestEvidenceRefs.has(evidenceRef));
  if (invalidEvidenceRef) {
    return createBoundaryFailure("fail", `Child output referenced unknown evidence ${invalidEvidenceRef}.`, "output_boundary_violation");
  }

  const criticalFlag = input.detection.dataQualityFlags.find((flag) => CRITICAL_FLAGS.has(flag));
  if (criticalFlag) {
    return createBoundaryFailure("review_required", `Child output carried critical data-quality flag ${criticalFlag}.`, criticalFlag === "low_confidence" ? "low_confidence" : "insufficient_signal", [criticalFlag]);
  }

  return { ok: true, outputBoundaryDecision: "allow", criticalDataQualityDecision: "allow" };
}

function createBoundaryFailure(
  decision: "review_required" | "fail",
  stateSummary: string,
  failureReason: PageStateGateFailure["failureReason"],
  dataQualityFlags: PageStateGateFailure["dataQualityFlags"] = ["output_boundary_violation"],
): {
  ok: false;
  outputBoundaryDecision: "review_required" | "fail";
  criticalDataQualityDecision: "review_required" | "fail";
  failure: PageStateGateFailure;
} {
  return {
    ok: false,
    outputBoundaryDecision: decision,
    criticalDataQualityDecision: decision,
    failure: {
      status: decision === "fail" ? "failed" : "review_required",
      decision,
      failureReason,
      stateSummary,
      reviewRequiredReason: decision === "review_required" ? stateSummary : null,
      pageStateType: "unknown_page",
      confidence: 0,
      dataQualityFlags,
    },
  };
}