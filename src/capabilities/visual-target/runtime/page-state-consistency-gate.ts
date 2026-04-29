import type { ParsedVisualTargetAbilityInput, VisualTargetDataQualityFlag, VisualTargetFailureReason } from "../contract.js";

function buildExpectedFingerprint(input: ParsedVisualTargetAbilityInput): string {
  return `${input.sourceProof.pageState.currentUrl}|${input.sourceProof.pageState.currentTitle ?? ""}|${input.sourceProof.pageState.pageStateType}`;
}

export function validatePageStateConsistency(input: {
  request: ParsedVisualTargetAbilityInput;
  allowedPageStateTypes: readonly string[];
}):
  | { ok: true; decision: "allow"; dataQualityFlags: VisualTargetDataQualityFlag[] }
  | {
      ok: false;
      status: "review_required" | "blocked";
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
      status: "blocked",
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
  if (pageStateProof.pageStateFingerprint !== buildExpectedFingerprint(input.request)) {
    return {
      ok: false,
      status: "review_required",
      decision: "review_required",
      failureReason: "page_state_fingerprint_mismatch",
      statusMessage: "Page State fingerprint does not match the governed visual target request.",
      reviewRequiredReason: "Visual Target requires review because the page-state fingerprint is inconsistent.",
      dataQualityFlags: ["page_state_conflict"],
    };
  }

  return { ok: true, decision: "allow", dataQualityFlags: [] };
}