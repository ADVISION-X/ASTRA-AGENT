import type { ParsedVisualTargetAbilityInput, VisualTargetDataQualityFlag, VisualTargetFailureReason } from "../contract.js";
import {
  createVisualTargetGateBlocked,
  createVisualTargetGateReviewRequired,
  createVisualTargetGateSuccess,
  type VisualTargetGateBlocked,
  type VisualTargetGateReviewRequired,
  type VisualTargetGateSuccess,
} from "./visual-target-gate-results.js";

type PageStateAllow = VisualTargetGateSuccess<"allow", {}>;
type PageStateBlocked = VisualTargetGateBlocked<"block", {}>;
type PageStateReviewRequired = VisualTargetGateReviewRequired<"review_required", {}>;

const PAGE_STATE_CONFLICT_FLAGS: VisualTargetDataQualityFlag[] = ["page_state_conflict"];

function matchesRequestedBinding(expected: string | null, actual: string | null): boolean {
  return expected === null || actual === expected;
}

function hasSharedBindingConflict(left: string | null, right: string | null): boolean {
  return left !== null && right !== null && left !== right;
}

function createPageStateBlocked(failureReason: VisualTargetFailureReason, statusMessage: string): PageStateBlocked {
  return createVisualTargetGateBlocked({
    decision: "block",
    failureReason,
    statusMessage,
    dataQualityFlags: PAGE_STATE_CONFLICT_FLAGS,
    extra: {},
  });
}

function createPageStateReview(statusMessage: string, reviewRequiredReason: string): PageStateReviewRequired {
  return createVisualTargetGateReviewRequired({
    decision: "review_required",
    failureReason: "page_state_review_required",
    statusMessage,
    reviewRequiredReason,
    dataQualityFlags: PAGE_STATE_CONFLICT_FLAGS,
    extra: {},
  });
}

function resolvePageStateConflict(input: {
  request: ParsedVisualTargetAbilityInput;
  allowedPageStateChildCapabilityIds: readonly string[];
}): PageStateBlocked | PageStateReviewRequired | null {
  const pageStateProof = input.request.sourceProof.pageState;
  const screenshotProof = input.request.sourceProof.screenshot;
  const aiProof = input.request.sourceProof.ai;
  if (pageStateProof.pageStateStatus === "failed") {
    return createPageStateBlocked("page_state_blocked", "Page State blocked governed target selection for the current page.");
  }
  if (pageStateProof.pageStateStatus === "review_required") {
    return createPageStateReview(
      "Page State requires review before Visual Target can return success.",
      "Visual Target cannot resolve target success while Page State is review_required.",
    );
  }
  if (pageStateProof.missionId !== input.request.missionId) {
    return createPageStateBlocked("page_state_binding_mismatch", "Page State proof missionId must match the Visual Target request.");
  }
  if (pageStateProof.runId !== input.request.runId) {
    return createPageStateBlocked("page_state_binding_mismatch", "Page State proof runId must match the Visual Target request.");
  }
  if (pageStateProof.sessionId !== input.request.sessionId) {
    return createPageStateBlocked("page_state_blocked", "Page State proof session binding must match the Visual Target request.");
  }
  if (!matchesRequestedBinding(input.request.roundId, pageStateProof.roundId)) {
    return createPageStateBlocked("page_state_binding_mismatch", "Page State proof roundId must match the Visual Target request.");
  }
  if (!matchesRequestedBinding(input.request.videoVisitId, pageStateProof.videoVisitId)) {
    return createPageStateBlocked("page_state_binding_mismatch", "Page State proof videoVisitId must match the Visual Target request.");
  }
  if (hasSharedBindingConflict(screenshotProof.roundId, pageStateProof.roundId)) {
    return createPageStateBlocked("page_state_binding_mismatch", "Page State proof roundId must stay aligned with screenshot proof.");
  }
  if (hasSharedBindingConflict(screenshotProof.videoVisitId, pageStateProof.videoVisitId)) {
    return createPageStateBlocked("page_state_binding_mismatch", "Page State proof videoVisitId must stay aligned with screenshot proof.");
  }
  if (hasSharedBindingConflict(screenshotProof.missionId, pageStateProof.missionId)) {
    return createPageStateBlocked("page_state_binding_mismatch", "Page State proof missionId must stay aligned with screenshot proof.");
  }
  if (hasSharedBindingConflict(screenshotProof.runId, pageStateProof.runId)) {
    return createPageStateBlocked("page_state_binding_mismatch", "Page State proof runId must stay aligned with screenshot proof.");
  }
  if (aiProof && hasSharedBindingConflict(aiProof.roundId, pageStateProof.roundId)) {
    return createPageStateBlocked("page_state_binding_mismatch", "Page State proof roundId must stay aligned with AI proof.");
  }
  if (aiProof && hasSharedBindingConflict(aiProof.videoVisitId, pageStateProof.videoVisitId)) {
    return createPageStateBlocked("page_state_binding_mismatch", "Page State proof videoVisitId must stay aligned with AI proof.");
  }
  if (aiProof && hasSharedBindingConflict(aiProof.missionId, pageStateProof.missionId)) {
    return createPageStateBlocked("page_state_binding_mismatch", "Page State proof missionId must stay aligned with AI proof.");
  }
  if (aiProof && hasSharedBindingConflict(aiProof.runId, pageStateProof.runId)) {
    return createPageStateBlocked("page_state_binding_mismatch", "Page State proof runId must stay aligned with AI proof.");
  }
  if (!input.allowedPageStateChildCapabilityIds.includes(pageStateProof.pageStateChildCapabilityId)) {
    return createPageStateReview(
      `Page State ${pageStateProof.pageStateChildCapabilityId} is not valid for ${input.request.childCapabilityId}.`,
      "Visual Target detected a page-state conflict for the requested child capability.",
    );
  }
  return !pageStateProof.pageStateFingerprint || !pageStateProof.pageStateHash
    ? createPageStateBlocked("page_state_hash_missing", "Page State proof must carry fingerprint and pageStateHash.")
    : null;
}

export function validatePageStateConsistency(input: {
  request: ParsedVisualTargetAbilityInput;
  allowedPageStateChildCapabilityIds: readonly string[];
}): PageStateAllow | PageStateBlocked | PageStateReviewRequired {
  const failure = resolvePageStateConflict(input);
  if (failure) {
    return failure;
  }

  return createVisualTargetGateSuccess("allow", [], {});
}