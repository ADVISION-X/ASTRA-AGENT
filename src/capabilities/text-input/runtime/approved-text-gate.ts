import type { ParsedTextInputAbilityInput } from "../contract.js";
import { hashTextValue } from "../shared/text-input-types.js";

const WRITING_CHILDREN = new Set(["type-text", "paste-text", "replace-input"]);

export function validateApprovedText(input: { request: ParsedTextInputAbilityInput }) {
  if (!WRITING_CHILDREN.has(input.request.childCapabilityId)) {
    return {
      ok: true as const,
      policyDecision: "allow" as const,
      statusMessage: "Text Input approved-text gate passed.",
      textLength: 0,
      dataQualityFlags: [] as string[],
    };
  }

  const inputText = input.request.inputText ?? "";
  const inputTextRef = input.request.inputTextRef ?? "";
  const approvedText = input.request.approvedText ?? "";
  const approvedTextRef = input.request.approvedTextRef ?? "";

  if (inputText.length === 0) {
    return {
      ok: false as const,
      status: "failed" as const,
      failureReason: "input_text_required" as const,
      reviewRequiredReason: null,
      policyDecision: "block" as const,
      statusMessage: "Text Input requires inputText for the selected child capability.",
      dataQualityFlags: ["input_text_required"],
    };
  }

  if (inputTextRef.length === 0) {
    return {
      ok: false as const,
      status: "failed" as const,
      failureReason: "input_text_ref_required" as const,
      reviewRequiredReason: null,
      policyDecision: "block" as const,
      statusMessage: "Text Input requires inputTextRef for the selected child capability.",
      dataQualityFlags: ["input_text_ref_required"],
    };
  }

  if (approvedText.length === 0) {
    return {
      ok: false as const,
      status: "failed" as const,
      failureReason: "missing_approved_text" as const,
      reviewRequiredReason: null,
      policyDecision: "block" as const,
      statusMessage: "Text Input requires approvedText for the selected child capability.",
      dataQualityFlags: ["missing_approved_text"],
    };
  }

  if (approvedTextRef.length === 0) {
    return {
      ok: false as const,
      status: "failed" as const,
      failureReason: "approved_text_ref_required" as const,
      reviewRequiredReason: null,
      policyDecision: "block" as const,
      statusMessage: "Text Input requires approvedTextRef for the selected child capability.",
      dataQualityFlags: ["approved_text_ref_required"],
    };
  }

  const inputHash = hashTextValue(inputText);
  if (input.request.inputTextHash !== inputHash) {
    return {
      ok: false as const,
      status: "failed" as const,
      failureReason: "input_text_hash_mismatch" as const,
      reviewRequiredReason: null,
      policyDecision: "block" as const,
      statusMessage: "Text Input rejected inputText because inputTextHash does not match the governed payload.",
      dataQualityFlags: ["input_text_hash_mismatch"],
    };
  }

  const approvedHash = hashTextValue(approvedText);
  if (input.request.approvedTextHash !== approvedHash) {
    return {
      ok: false as const,
      status: "failed" as const,
      failureReason: "approved_text_hash_mismatch" as const,
      reviewRequiredReason: null,
      policyDecision: "block" as const,
      statusMessage: "Text Input rejected approvedText because approvedTextHash does not match the approved payload.",
      dataQualityFlags: ["approved_text_hash_mismatch"],
    };
  }

  if (input.request.inputTextHash !== input.request.approvedTextHash || inputText !== approvedText) {
    return {
      ok: false as const,
      status: "failed" as const,
      failureReason: "approved_text_hash_mismatch" as const,
      reviewRequiredReason: null,
      policyDecision: "block" as const,
      statusMessage: "Text Input only writes text whose governed input payload exactly matches the approved payload.",
      dataQualityFlags: ["approved_text_chain_mismatch"],
    };
  }

  const textLength = inputText.length;
  if (textLength > input.request.policy.maxLengthPolicy.maxLength) {
    const status = input.request.policy.maxLengthPolicy.failureStatus;
    return {
      ok: false as const,
      status,
      failureReason: status === "failed" ? ("text_too_long" as const) : null,
      reviewRequiredReason: status === "review_required"
        ? `Text Input payload length ${textLength} exceeds governed maxLength ${input.request.policy.maxLengthPolicy.maxLength}.`
        : null,
      policyDecision: status === "failed" ? ("block" as const) : ("review_required" as const),
      statusMessage: `Text Input payload length ${textLength} exceeds governed maxLength ${input.request.policy.maxLengthPolicy.maxLength}.`,
      dataQualityFlags: ["text_too_long"],
    };
  }

  return {
    ok: true as const,
    policyDecision: "allow" as const,
    statusMessage: "Text Input approved-text gate passed.",
    textLength,
    dataQualityFlags: [] as string[],
  };
}