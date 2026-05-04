import type { ParsedTextInputAbilityInput } from "../contract.js";

const WRITE_CHILDREN = new Set(["type-text", "paste-text", "replace-input"]);

const buildTextSourcePassResult = () => ({
  ok: true as const,
  policyDecision: "allow" as const,
  dataQualityFlags: [] as string[],
});

const buildTextSourceFailureResult = (input: {
  failureReason: "source_owner_required" | "source_proof_ref_required" | "source_ref_required";
  statusMessage: string;
  dataQualityFlag: string;
}) => ({
  ok: false as const,
  status: "failed" as const,
  failureReason: input.failureReason,
  reviewRequiredReason: null,
  statusMessage: input.statusMessage,
  policyDecision: "block" as const,
  dataQualityFlags: [input.dataQualityFlag],
});

function validateTextSourceOwner(input: { request: ParsedTextInputAbilityInput }) {
  return input.request.sourceOwner === null
    ? buildTextSourceFailureResult({
        failureReason: "source_owner_required",
        statusMessage: "Text Input requires sourceOwner for governed write operations.",
        dataQualityFlag: "source_owner_missing",
      })
    : null;
}

function validateTextSourceProofRef(input: { request: ParsedTextInputAbilityInput }) {
  return input.request.sourceProofRef === null
    ? buildTextSourceFailureResult({
        failureReason: "source_proof_ref_required",
        statusMessage: "Text Input requires sourceProofRef for governed write operations.",
        dataQualityFlag: "source_proof_ref_missing",
      })
    : null;
}

function validateTextSourceRef(input: { request: ParsedTextInputAbilityInput }) {
  return !input.request.sourceRef
    ? buildTextSourceFailureResult({
        failureReason: "source_ref_required",
        statusMessage: "Text Input requires sourceRef for governed write operations.",
        dataQualityFlag: "source_ref_missing",
      })
    : null;
}

export function validateTextSourceProof(input: { request: ParsedTextInputAbilityInput }) {
  if (!WRITE_CHILDREN.has(input.request.childCapabilityId)) {
    return buildTextSourcePassResult();
  }

  const failure = validateTextSourceOwner(input)
    ?? validateTextSourceProofRef(input)
    ?? validateTextSourceRef(input);
  if (failure) {
    return failure;
  }

  return buildTextSourcePassResult();
}