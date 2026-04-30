import type { PageStateAbilityInput } from "../schema.js";
import type { PageStateGateFailure } from "../shared/page-state-types.js";

const ALLOWED_SOURCE_CHILDREN: Record<string, readonly string[]> = {
  open: ["open-tiktok", "open-facebook", "open-local-workbench"],
  screenshot: ["capture-browser-viewport", "capture-region", "capture-page-snapshot"],
  "visual-target": ["detect-feed-card", "detect-video-player", "detect-comment-panel", "detect-modal-overlay", "detect-captcha"],
  "post-action-verification": ["verify-open-handoff", "verify-page-transition", "verify-safety-check"],
  "runtime-signal": ["runtime-signal", "page-runtime-signal", "local-runtime-signal"],
};

export function gateObservationProofBinding(request: PageStateAbilityInput):
  | { ok: true; observationBindingDecision: "bound" }
  | { ok: false; observationBindingDecision: "review_required" | "fail"; failure: PageStateGateFailure } {
  const evidenceRefSet = new Set(request.sourceEvidenceRefs);

  for (const observation of request.observations) {
    if (!observation.sourceProofRef || observation.sourceProofRef.length === 0) {
      return createBindingFailure("fail", `Observation ${observation.observationId} is missing source proof binding.`);
    }

    const allowedChildren = ALLOWED_SOURCE_CHILDREN[observation.sourceAbilityGroupId] ?? [];
    if (!allowedChildren.includes(observation.sourceChildCapabilityId)) {
      return createBindingFailure("fail", `Observation ${observation.observationId} uses a forbidden source child capability.`);
    }

    const supportingRefMatched = request.sourceEvidenceRefs.some((ref) => observation.sourceProofRef.includes(ref) || ref.includes(observation.sourceProofRef));
    const openProofMatched = observation.sourceProofRef === request.openHandoff.openProofRef;
    const snapshotProofMatched = observation.sourceProofRef === request.snapshot.sourceProofRef;
    if (!supportingRefMatched && !openProofMatched && !snapshotProofMatched && evidenceRefSet.size > 0) {
      return createBindingFailure("review_required", `Observation ${observation.observationId} proof cannot be bound to the request evidence chain.`);
    }
  }

  return { ok: true, observationBindingDecision: "bound" };
}

function createBindingFailure(
  decision: "review_required" | "fail",
  stateSummary: string,
): { ok: false; observationBindingDecision: "review_required" | "fail"; failure: PageStateGateFailure } {
  return {
    ok: false,
    observationBindingDecision: decision,
    failure: {
      status: decision === "fail" ? "failed" : "review_required",
      decision,
      failureReason: decision === "fail" ? "observation_source_forbidden" : "observation_source_mismatch",
      stateSummary,
      reviewRequiredReason: decision === "fail" ? null : stateSummary,
      pageStateType: "unknown_page",
      confidence: 0,
      dataQualityFlags: ["source_mismatch"],
    },
  };
}