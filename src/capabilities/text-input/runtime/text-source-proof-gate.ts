import type { ParsedTextInputAbilityInput } from "../contract.js";

const WRITE_CHILDREN = new Set(["type-text", "paste-text", "replace-input"]);

export function validateTextSourceProof(input: { request: ParsedTextInputAbilityInput }) {
  if (!WRITE_CHILDREN.has(input.request.childCapabilityId)) {
    return {
      ok: true as const,
      policyDecision: "allow" as const,
      dataQualityFlags: [] as string[],
    };
  }

  if (input.request.sourceOwner === null) {
    return {
      ok: false as const,
      status: "failed" as const,
      failureReason: "source_owner_required" as const,
      reviewRequiredReason: null,
      statusMessage: "Text Input requires sourceOwner for governed write operations.",
      policyDecision: "block" as const,
      dataQualityFlags: ["source_owner_missing"],
    };
  }

  if (input.request.sourceProofRef === null) {
    return {
      ok: false as const,
      status: "failed" as const,
      failureReason: "source_proof_ref_required" as const,
      reviewRequiredReason: null,
      statusMessage: "Text Input requires sourceProofRef for governed write operations.",
      policyDecision: "block" as const,
      dataQualityFlags: ["source_proof_ref_missing"],
    };
  }

  if (!input.request.sourceRef) {
    return {
      ok: false as const,
      status: "failed" as const,
      failureReason: "source_ref_required" as const,
      reviewRequiredReason: null,
      statusMessage: "Text Input requires sourceRef for governed write operations.",
      policyDecision: "block" as const,
      dataQualityFlags: ["source_ref_missing"],
    };
  }

  return {
    ok: true as const,
    policyDecision: "allow" as const,
    dataQualityFlags: [] as string[],
  };
}