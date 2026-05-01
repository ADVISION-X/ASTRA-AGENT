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
  allowedPageStateTypes: readonly string[];
}): PageStateBlocked | PageStateReviewRequired | null {
  const pageStateProof = input.request.sourceProof.pageState;
  if (pageStateProof.decision === "block") {
    return createPageStateBlocked("page_state_blocked", "Page State blocked governed target selection for the current page.");
  }
  if (pageStateProof.decision === "review_required") {
    return createPageStateReview(
      "Page State requires review before Visual Target can return success.",
      "Visual Target cannot resolve target success while Page State is review_required.",
    );
  }
  if (pageStateProof.sessionId !== input.request.sessionId) {
    return createPageStateBlocked("page_state_blocked", "Page State proof session binding must match the Visual Target request.");
  }
  if (!input.allowedPageStateTypes.includes(pageStateProof.pageStateType)) {
    return createPageStateReview(
      `Page State ${pageStateProof.pageStateType} is not valid for ${input.request.childCapabilityId}.`,
      "Visual Target detected a page-state conflict for the requested child capability.",
    );
  }
  return !pageStateProof.pageStateFingerprint || !pageStateProof.pageStateHash
    ? createPageStateBlocked("page_state_hash_missing", "Page State proof must carry fingerprint and pageStateHash.")
    : null;
}

export function validatePageStateConsistency(input: {
  request: ParsedVisualTargetAbilityInput;
  allowedPageStateTypes: readonly string[];
}): PageStateAllow | PageStateBlocked | PageStateReviewRequired {
  const failure = resolvePageStateConflict(input);
  if (failure) {
    return failure;
  }

  return createVisualTargetGateSuccess("allow", [], {});
}