import type { PageStateAbilityInput } from "../schema.js";
import type { PageStateGateFailure } from "../shared/page-state-types.js";

const ALLOWED_SOURCE_CHILDREN: Record<string, readonly string[]> = {
  open: ["open-tiktok", "open-facebook", "open-local-workbench"],
  screenshot: ["capture-browser-viewport", "capture-region", "capture-page-snapshot"],
  "visual-target": ["detect-feed-card", "detect-video-player", "detect-comment-panel", "detect-modal-overlay", "detect-captcha"],
  "post-action-verification": ["verify-open-handoff", "verify-page-transition", "verify-safety-check"],
  "runtime-signal": ["runtime-signal", "page-runtime-signal", "local-runtime-signal"],
};

function resolveObservationBindingFailure(input: {
  observation: PageStateAbilityInput["observations"][number];
  request: PageStateAbilityInput;
  evidenceRefSet: Set<string>;
}): { decision: "review_required" | "fail"; reason: string } | null {
  if (!input.observation.sourceProofRef || input.observation.sourceProofRef.length === 0) {
    return { decision: "fail", reason: `Observation ${input.observation.observationId} is missing source proof binding.` };
  }

  const allowedChildren = ALLOWED_SOURCE_CHILDREN[input.observation.sourceAbilityGroupId] ?? [];
  if (!allowedChildren.includes(input.observation.sourceChildCapabilityId)) {
    return { decision: "fail", reason: `Observation ${input.observation.observationId} uses a forbidden source child capability.` };
  }

  const supportingRefMatched = input.request.sourceEvidenceRefs.some((ref) => input.observation.sourceProofRef.includes(ref) || ref.includes(input.observation.sourceProofRef));
  const openProofMatched = input.observation.sourceProofRef === input.request.openHandoff.openProofRef;
  const snapshotProofMatched = input.observation.sourceProofRef === input.request.snapshot.sourceProofRef;
  if (!supportingRefMatched && !openProofMatched && !snapshotProofMatched && input.evidenceRefSet.size > 0) {
    return { decision: "review_required", reason: `Observation ${input.observation.observationId} proof cannot be bound to the request evidence chain.` };
  }

  return null;
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

export function gateObservationProofBinding(request: PageStateAbilityInput):
  | { ok: true; observationBindingDecision: "bound" }
  | { ok: false; observationBindingDecision: "review_required" | "fail"; failure: PageStateGateFailure } {
  const evidenceRefSet = new Set(request.sourceEvidenceRefs);

  for (const observation of request.observations) {
    const bindingFailure = resolveObservationBindingFailure({ observation, request, evidenceRefSet });
    if (bindingFailure) {
      return createBindingFailure(bindingFailure.decision, bindingFailure.reason);
    }
  }

  return { ok: true, observationBindingDecision: "bound" };
}