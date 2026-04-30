import type { ParsedVisualTargetAbilityInput, VisualTargetDataQualityFlag, VisualTargetFailureReason } from "../contract.js";

export function validatePageStateConsistency(input: {
  request: ParsedVisualTargetAbilityInput;
  allowedPageStateTypes: readonly string[];
}):
  | { ok: true; decision: "allow"; dataQualityFlags: VisualTargetDataQualityFlag[] }
  | {
      ok: false;
      status: "failed" | "review_required";
      decision: "review_required" | "block";
      failureReason: VisualTargetFailureReason;
      statusMessage: string;
      reviewRequiredReason: string | null;
      dataQualityFlags: VisualTargetDataQualityFlag[];
    } {
  const pageStateProof = input.request.sourceProof.pageState;
  if (pageStateProof.decision === "block") {
    return {
      ok: false,
      status: "failed",
      decision: "block",
      failureReason: "page_state_blocked",
      statusMessage: "Page State blocked governed target selection for the current page.",
      reviewRequiredReason: null,
      dataQualityFlags: ["page_state_conflict"],
    };
  }
  if (pageStateProof.decision === "review_required") {
    return {
      ok: false,
      status: "review_required",
      decision: "review_required",
      failureReason: "page_state_review_required",
      statusMessage: "Page State requires review before Visual Target can return success.",
      reviewRequiredReason: "Visual Target cannot resolve target success while Page State is review_required.",
      dataQualityFlags: ["page_state_conflict"],
    };
  }
  if (pageStateProof.sessionId !== input.request.sessionId) {
    return {
      ok: false,
      status: "failed",
      decision: "block",
      failureReason: "page_state_blocked",
      statusMessage: "Page State proof session binding must match the Visual Target request.",
      reviewRequiredReason: null,
      dataQualityFlags: ["page_state_conflict"],
    };
  }
  if (!input.allowedPageStateTypes.includes(pageStateProof.pageStateType)) {
    return {
      ok: false,
      status: "review_required",
      decision: "review_required",
      failureReason: "page_state_review_required",
      statusMessage: `Page State ${pageStateProof.pageStateType} is not valid for ${input.request.childCapabilityId}.`,
      reviewRequiredReason: "Visual Target detected a page-state conflict for the requested child capability.",
      dataQualityFlags: ["page_state_conflict"],
    };
  }
  if (!pageStateProof.pageStateFingerprint || !pageStateProof.pageStateHash) {
    return {
      ok: false,
      status: "failed",
      decision: "block",
      failureReason: "page_state_hash_missing",
      statusMessage: "Page State proof must carry fingerprint and pageStateHash.",
      reviewRequiredReason: null,
      dataQualityFlags: ["page_state_conflict"],
    };
  }

  return { ok: true, decision: "allow", dataQualityFlags: [] };
}