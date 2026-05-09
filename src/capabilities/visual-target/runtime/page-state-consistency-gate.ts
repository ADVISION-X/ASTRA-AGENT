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

function createPageStateBindingMismatch(statusMessage: string): PageStateBlocked {
  return createPageStateBlocked("page_state_binding_mismatch", statusMessage);
}

function findPageStateStatusConflict(pageStateProof: ParsedVisualTargetAbilityInput["sourceProof"]["pageState"]): PageStateBlocked | PageStateReviewRequired | null {
  if (pageStateProof.pageStateStatus === "failed") {
    return createPageStateBlocked("page_state_blocked", "Page State blocked governed target selection for the current page.");
  }
  return pageStateProof.pageStateStatus === "review_required"
    ? createPageStateReview(
      "Page State requires review before Visual Target can return success.",
      "Visual Target cannot resolve target success while Page State is review_required.",
    )
    : null;
}

function findPageStateRequestBindingConflict(request: ParsedVisualTargetAbilityInput): PageStateBlocked | null {
  const pageStateProof = request.sourceProof.pageState;
  if (pageStateProof.missionId !== request.missionId) {
    return createPageStateBindingMismatch("Page State proof missionId must match the Visual Target request.");
  }
  if (pageStateProof.runId !== request.runId) {
    return createPageStateBindingMismatch("Page State proof runId must match the Visual Target request.");
  }
  if (pageStateProof.sessionId !== request.sessionId) {
    return createPageStateBlocked("page_state_blocked", "Page State proof session binding must match the Visual Target request.");
  }
  if (!matchesRequestedBinding(request.roundId, pageStateProof.roundId)) {
    return createPageStateBindingMismatch("Page State proof roundId must match the Visual Target request.");
  }
  return !matchesRequestedBinding(request.videoVisitId, pageStateProof.videoVisitId)
    ? createPageStateBindingMismatch("Page State proof videoVisitId must match the Visual Target request.")
    : null;
}

function findPageStateSharedBindingConflict(label: string, left: string | null, right: string | null): PageStateBlocked | null {
  return hasSharedBindingConflict(left, right)
    ? createPageStateBindingMismatch(`Page State proof ${label} must stay aligned with governed evidence.`)
    : null;
}

function findPageStateEvidenceBindingConflict(request: ParsedVisualTargetAbilityInput): PageStateBlocked | null {
  const pageStateProof = request.sourceProof.pageState;
  const screenshotProof = request.sourceProof.screenshot;
  const sharedBindingConflicts = [
    findPageStateSharedBindingConflict("roundId", screenshotProof.roundId, pageStateProof.roundId),
    findPageStateSharedBindingConflict("videoVisitId", screenshotProof.videoVisitId, pageStateProof.videoVisitId),
    findPageStateSharedBindingConflict("missionId", screenshotProof.missionId, pageStateProof.missionId),
    findPageStateSharedBindingConflict("runId", screenshotProof.runId, pageStateProof.runId),
    request.sourceProof.ai ? findPageStateSharedBindingConflict("roundId", request.sourceProof.ai.roundId, pageStateProof.roundId) : null,
    request.sourceProof.ai ? findPageStateSharedBindingConflict("videoVisitId", request.sourceProof.ai.videoVisitId, pageStateProof.videoVisitId) : null,
    request.sourceProof.ai ? findPageStateSharedBindingConflict("missionId", request.sourceProof.ai.missionId, pageStateProof.missionId) : null,
    request.sourceProof.ai ? findPageStateSharedBindingConflict("runId", request.sourceProof.ai.runId, pageStateProof.runId) : null,
  ];

  return sharedBindingConflicts.find((conflict) => conflict !== null) ?? null;
}

function resolvePageStateConflict(input: {
  request: ParsedVisualTargetAbilityInput;
  allowedPageStateChildCapabilityIds: readonly string[];
}): PageStateBlocked | PageStateReviewRequired | null {
  const pageStateProof = input.request.sourceProof.pageState;
  const statusConflict = findPageStateStatusConflict(pageStateProof);
  if (statusConflict) {
    return statusConflict;
  }

  const requestBindingConflict = findPageStateRequestBindingConflict(input.request);
  if (requestBindingConflict) {
    return requestBindingConflict;
  }

  const evidenceBindingConflict = findPageStateEvidenceBindingConflict(input.request);
  if (evidenceBindingConflict) {
    return evidenceBindingConflict;
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