import type { ParsedTextInputAbilityInput } from "../contract.js";

const FOCUS_PROOF_MAX_AGE_MS = 120000;

export function validateFocusProof(input: { request: ParsedTextInputAbilityInput; currentIsoTimestamp: string }) {
  if (input.request.focusProofRef.length === 0) {
    return {
      ok: false as const,
      status: "failed" as const,
      failureReason: "focus_proof_ref_required" as const,
      reviewRequiredReason: null,
      statusMessage: "Text Input requires focusProofRef before text entry.",
      policyDecision: "block" as const,
      dataQualityFlags: ["focus_proof_ref_missing"],
    };
  }

  const focusVerifiedAtMs = Date.parse(input.request.focusVerifiedAt);
  const currentMs = Date.parse(input.currentIsoTimestamp);
  if (!Number.isFinite(focusVerifiedAtMs) || !Number.isFinite(currentMs)) {
    return {
      ok: false as const,
      status: "review_required" as const,
      failureReason: null,
      reviewRequiredReason: "Text Input could not validate focus proof freshness.",
      statusMessage: "Text Input could not validate focus proof freshness.",
      policyDecision: "review_required" as const,
      dataQualityFlags: ["focus_proof_invalid_timestamp"],
    };
  }

  if (currentMs - focusVerifiedAtMs > FOCUS_PROOF_MAX_AGE_MS) {
    return {
      ok: false as const,
      status: "review_required" as const,
      failureReason: null,
      reviewRequiredReason: "Text Input focus proof is stale and must be refreshed before input execution.",
      statusMessage: "Text Input focus proof is stale and must be refreshed before input execution.",
      policyDecision: "review_required" as const,
      dataQualityFlags: ["focus_proof_stale"],
    };
  }

  return {
    ok: true as const,
    policyDecision: "allow" as const,
    dataQualityFlags: [] as string[],
  };
}