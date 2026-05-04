import type { ParsedTextInputAbilityInput } from "../contract.js";

const FOCUS_PROOF_MAX_AGE_MS = 120000;

const buildFocusProofFailure = (input: {
  status: "failed" | "review_required";
  failureReason: "focus_proof_ref_required" | "focus_binding_invalid" | null;
  reviewRequiredReason: string | null;
  statusMessage: string;
  policyDecision: "block" | "review_required";
  dataQualityFlag: string;
}) => ({
  ok: false as const,
  status: input.status,
  failureReason: input.failureReason,
  reviewRequiredReason: input.reviewRequiredReason,
  statusMessage: input.statusMessage,
  policyDecision: input.policyDecision,
  dataQualityFlags: [input.dataQualityFlag],
});

function validateFocusProofPresence(input: { request: ParsedTextInputAbilityInput }) {
  if (input.request.focusProofRef.length === 0) {
    return buildFocusProofFailure({
      status: "failed",
      failureReason: "focus_proof_ref_required",
      reviewRequiredReason: null,
      statusMessage: "Text Input requires focusProofRef before text entry.",
      policyDecision: "block",
      dataQualityFlag: "focus_proof_ref_missing",
    });
  }

  return null;
}

function validateMouseClickFocusBinding(input: { request: ParsedTextInputAbilityInput }) {
  return input.request.focusProofOwner === "mouse-click" && input.request.mouseClickProofRef === null
    ? buildFocusProofFailure({
        status: "failed",
        failureReason: "focus_binding_invalid",
        reviewRequiredReason: null,
        statusMessage: "Text Input requires mouseClickProofRef when focusProofOwner is mouse-click.",
        policyDecision: "block",
        dataQualityFlag: "mouse_click_proof_ref_missing",
      })
    : null;
}

function validateFocusProofFreshness(input: { request: ParsedTextInputAbilityInput; currentIsoTimestamp: string }) {
  const focusVerifiedAtMs = Date.parse(input.request.focusVerifiedAt);
  const currentMs = Date.parse(input.currentIsoTimestamp);
  if (!Number.isFinite(focusVerifiedAtMs) || !Number.isFinite(currentMs)) {
    return buildFocusProofFailure({
      status: "review_required",
      failureReason: null,
      reviewRequiredReason: "Text Input could not validate focus proof freshness.",
      statusMessage: "Text Input could not validate focus proof freshness.",
      policyDecision: "review_required",
      dataQualityFlag: "focus_proof_invalid_timestamp",
    });
  }

  if (currentMs - focusVerifiedAtMs > FOCUS_PROOF_MAX_AGE_MS) {
    return buildFocusProofFailure({
      status: "review_required",
      failureReason: null,
      reviewRequiredReason: "Text Input focus proof is stale and must be refreshed before input execution.",
      statusMessage: "Text Input focus proof is stale and must be refreshed before input execution.",
      policyDecision: "review_required",
      dataQualityFlag: "focus_proof_stale",
    });
  }

  return null;
}

export function validateFocusProof(input: { request: ParsedTextInputAbilityInput; currentIsoTimestamp: string }) {
  const failure = validateFocusProofPresence(input)
    ?? validateMouseClickFocusBinding(input)
    ?? validateFocusProofFreshness(input);
  if (failure) {
    return failure;
  }

  return {
    ok: true as const,
    policyDecision: "allow" as const,
    dataQualityFlags: [] as string[],
  };
}