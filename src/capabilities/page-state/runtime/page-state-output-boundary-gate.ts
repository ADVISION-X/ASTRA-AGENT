import type { PageStateAbilityInput, PageStateChildDetection, PageStateDataQualityFlag } from "../schema.js";
import { childRequiresObservationSupport } from "../shared/page-state-policy.js";
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

function getInvalidObservationId(input: { request: PageStateAbilityInput; detection: PageStateChildDetection }): string | null {
  const requestObservationIds = new Set(input.request.observations.map((observation) => observation.observationId));
  return input.detection.matchedObservationIds.find((observationId) => !requestObservationIds.has(observationId)) ?? null;
}

function getInvalidEvidenceRef(input: { request: PageStateAbilityInput; detection: PageStateChildDetection }): string | null {
  const requestEvidenceRefs = new Set(input.request.sourceEvidenceRefs);
  return input.detection.supportingEvidenceRefs.find((evidenceRef) => !requestEvidenceRefs.has(evidenceRef)) ?? null;
}

function validateBoundaryIdentity(input: { request: PageStateAbilityInput; detection: PageStateChildDetection }) {
  return input.detection.childCapabilityId !== input.request.childCapabilityId
    ? createBoundaryFailure("fail", "Page State child output escaped its governed child capability id.", "output_boundary_violation")
    : null;
}

function validateBoundaryReferences(input: { request: PageStateAbilityInput; detection: PageStateChildDetection }) {
  const invalidObservationId = getInvalidObservationId(input);
  if (invalidObservationId) {
    return createBoundaryFailure("fail", `Child output referenced unknown observation ${invalidObservationId}.`, "output_boundary_violation");
  }

  const invalidEvidenceRef = getInvalidEvidenceRef(input);
  return invalidEvidenceRef
    ? createBoundaryFailure("fail", `Child output referenced unknown evidence ${invalidEvidenceRef}.`, "output_boundary_violation")
    : null;
}

function validateBoundarySupport(input: { request: PageStateAbilityInput; detection: PageStateChildDetection }) {
  if (input.detection.supportingEvidenceRefs.length === 0) {
    return createBoundaryFailure("fail", "Child output must retain supporting evidence refs before Page State can succeed.", "output_boundary_violation", ["insufficient_signal"]);
  }

  return childRequiresObservationSupport(input.request.childCapabilityId) && input.detection.matchedObservationIds.length === 0
    ? createBoundaryFailure("review_required", `Child ${input.request.childCapabilityId} requires governed observation refs before success.`, "missing_observation_support", ["missing_observation"])
    : null;
}

function validateCriticalDataQuality(input: { detection: PageStateChildDetection }) {
  const criticalFlag = input.detection.dataQualityFlags.find((flag) => CRITICAL_FLAGS.has(flag));
  return criticalFlag
    ? createBoundaryFailure("review_required", `Child output carried critical data-quality flag ${criticalFlag}.`, criticalFlag === "low_confidence" ? "low_confidence" : "insufficient_signal", [criticalFlag])
    : null;
}

export function gatePageStateOutputBoundary(input: {
  request: PageStateAbilityInput;
  detection: PageStateChildDetection;
}):
  | { ok: true; outputBoundaryDecision: "allow"; criticalDataQualityDecision: "allow" }
  | { ok: false; outputBoundaryDecision: "review_required" | "fail"; criticalDataQualityDecision: "review_required" | "fail"; failure: PageStateGateFailure } {
  const boundaryFailure = validateBoundaryIdentity(input)
    ?? validateBoundaryReferences(input)
    ?? validateBoundarySupport(input)
    ?? validateCriticalDataQuality(input);
  if (boundaryFailure) {
    return boundaryFailure;
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