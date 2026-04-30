import type { ParsedTextInputAbilityInput } from "../contract.js";

export function validateInputTargetProof(input: { request: ParsedTextInputAbilityInput }) {
  if (input.request.targetRef.length === 0) {
    return {
      ok: false as const,
      status: "failed" as const,
      failureReason: "target_ref_required" as const,
      reviewRequiredReason: null,
      statusMessage: "Text Input requires a governed targetRef.",
      policyDecision: "block" as const,
      dataQualityFlags: ["target_ref_missing"],
    };
  }

  if (input.request.targetProofRef.length === 0) {
    return {
      ok: false as const,
      status: "failed" as const,
      failureReason: "target_proof_ref_required" as const,
      reviewRequiredReason: null,
      statusMessage: "Text Input requires targetProofRef before writing or pressing keys.",
      policyDecision: "block" as const,
      dataQualityFlags: ["target_proof_ref_missing"],
    };
  }

  if (input.request.targetEvidenceRefs.length === 0) {
    return {
      ok: false as const,
      status: "review_required" as const,
      failureReason: null,
      reviewRequiredReason: "Text Input requires targetEvidenceRefs so the target proof remains reviewable.",
      statusMessage: "Text Input requires targetEvidenceRefs so the target proof remains reviewable.",
      policyDecision: "review_required" as const,
      dataQualityFlags: ["target_evidence_refs_missing"],
    };
  }

  if (input.request.roundId === null && input.request.videoVisitId === null) {
    return {
      ok: false as const,
      status: "review_required" as const,
      failureReason: null,
      reviewRequiredReason: "Text Input target proof must bind to roundId or videoVisitId.",
      statusMessage: "Text Input target proof must bind to roundId or videoVisitId.",
      policyDecision: "review_required" as const,
      dataQualityFlags: ["target_binding_incomplete"],
    };
  }

  return {
    ok: true as const,
    policyDecision: "allow" as const,
    dataQualityFlags: [] as string[],
  };
}