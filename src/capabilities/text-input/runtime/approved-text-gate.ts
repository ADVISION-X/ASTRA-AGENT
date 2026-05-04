import type { ParsedTextInputAbilityInput } from "../contract.js";
import { hashTextValue } from "../shared/text-input-types.js";

const WRITING_CHILDREN = new Set(["type-text", "paste-text", "replace-input"]);

const buildApprovedTextGatePassResult = (textLength: number) => ({
  ok: true as const,
  policyDecision: "allow" as const,
  statusMessage: "Text Input approved-text gate passed.",
  textLength,
  dataQualityFlags: [] as string[],
});

const buildApprovedTextGateFailureResult = (input: {
  failureReason: string;
  statusMessage: string;
  dataQualityFlag: string;
  status?: "failed" | "review_required";
  reviewRequiredReason?: string | null;
  policyDecision?: "block" | "review_required";
}) => ({
  ok: false as const,
  status: input.status ?? "failed" as const,
  failureReason: input.failureReason as "input_text_required" | "input_text_ref_required" | "missing_approved_text" | "approved_text_ref_required" | "approved_text_source_ref_required" | "approved_text_approval_ref_required" | "input_text_hash_mismatch" | "approved_text_hash_mismatch" | "approved_text_chain_mismatch" | "text_too_long",
  reviewRequiredReason: input.reviewRequiredReason ?? null,
  policyDecision: input.policyDecision ?? "block" as const,
  statusMessage: input.statusMessage,
  dataQualityFlags: [input.dataQualityFlag],
});

const validateApprovedTextInputTextFields = (input: { request: ParsedTextInputAbilityInput }) => {
  if (!input.request.inputText || input.request.inputText.length === 0) {
    return buildApprovedTextGateFailureResult({
      failureReason: "input_text_required",
      statusMessage: "Text Input requires inputText for the selected child capability.",
      dataQualityFlag: "input_text_required",
    });
  }

  if (!input.request.inputTextRef || input.request.inputTextRef.length === 0) {
    return buildApprovedTextGateFailureResult({
      failureReason: "input_text_ref_required",
      statusMessage: "Text Input requires inputTextRef for the selected child capability.",
      dataQualityFlag: "input_text_ref_required",
    });
  }

  return null;
};

const validateApprovedTextApprovedTextFields = (input: { request: ParsedTextInputAbilityInput }) => {
  return validateApprovedTextCoreFields(input) ?? validateApprovedTextApprovalChainFields(input);
};

const validateApprovedTextCoreFields = (input: { request: ParsedTextInputAbilityInput }) => {
  if (!input.request.approvedText || input.request.approvedText.length === 0) {
    return buildApprovedTextGateFailureResult({
      failureReason: "missing_approved_text",
      statusMessage: "Text Input requires approvedText for the selected child capability.",
      dataQualityFlag: "missing_approved_text",
    });
  }

  if (!input.request.approvedTextRef || input.request.approvedTextRef.length === 0) {
    return buildApprovedTextGateFailureResult({
      failureReason: "approved_text_ref_required",
      statusMessage: "Text Input requires approvedTextRef for the selected child capability.",
      dataQualityFlag: "approved_text_ref_required",
    });
  }

  return null;
};

const validateApprovedTextApprovalChainFields = (input: { request: ParsedTextInputAbilityInput }) => {
  if (!input.request.approvedTextSourceRef || input.request.approvedTextSourceRef.length === 0) {
    return buildApprovedTextGateFailureResult({
      failureReason: "approved_text_source_ref_required",
      statusMessage: "Text Input requires approvedTextSourceRef for the selected child capability.",
      dataQualityFlag: "approved_text_source_ref_required",
    });
  }

  if (!input.request.approvedTextApprovalRef || input.request.approvedTextApprovalRef.length === 0) {
    return buildApprovedTextGateFailureResult({
      failureReason: "approved_text_approval_ref_required",
      statusMessage: "Text Input requires approvedTextApprovalRef for the selected child capability.",
      dataQualityFlag: "approved_text_approval_ref_required",
    });
  }

  return null;
};

const validateApprovedTextInputHash = (input: { request: ParsedTextInputAbilityInput }) => {
  const inputHash = hashTextValue(input.request.inputText ?? "");
  if (input.request.inputTextHash !== inputHash) {
    return buildApprovedTextGateFailureResult({
      failureReason: "input_text_hash_mismatch",
      statusMessage: "Text Input rejected inputText because inputTextHash does not match the governed payload.",
      dataQualityFlag: "input_text_hash_mismatch",
    });
  }

  return null;
};

const validateApprovedTextApprovedHash = (input: { request: ParsedTextInputAbilityInput }) => {
  const approvedHash = hashTextValue(input.request.approvedText ?? "");
  if (input.request.approvedTextHash !== approvedHash) {
    return buildApprovedTextGateFailureResult({
      failureReason: "approved_text_hash_mismatch",
      statusMessage: "Text Input rejected approvedText because approvedTextHash does not match the approved payload.",
      dataQualityFlag: "approved_text_hash_mismatch",
    });
  }

  return null;
};

const validateApprovedTextExactMatch = (input: { request: ParsedTextInputAbilityInput }) => {
  if (input.request.inputTextHash !== input.request.approvedTextHash || (input.request.inputText ?? "") !== (input.request.approvedText ?? "")) {
    return buildApprovedTextGateFailureResult({
      failureReason: "approved_text_hash_mismatch",
      statusMessage: "Text Input only writes text whose governed input payload exactly matches the approved payload.",
      dataQualityFlag: "approved_text_chain_mismatch",
    });
  }

  return null;
};

const validateApprovedTextLengthPolicy = (input: { request: ParsedTextInputAbilityInput }) => {
  const textLength = (input.request.inputText ?? "").length;
  if (textLength <= input.request.policy.maxLengthPolicy.maxLength) {
    return null;
  }

  const status = input.request.policy.maxLengthPolicy.failureStatus;
  return buildApprovedTextGateFailureResult({
    status,
    failureReason: status === "failed" ? "text_too_long" : "text_too_long",
    reviewRequiredReason: status === "review_required"
      ? `Text Input payload length ${textLength} exceeds governed maxLength ${input.request.policy.maxLengthPolicy.maxLength}.`
      : null,
    policyDecision: status === "failed" ? "block" : "review_required",
    statusMessage: `Text Input payload length ${textLength} exceeds governed maxLength ${input.request.policy.maxLengthPolicy.maxLength}.`,
    dataQualityFlag: "text_too_long",
  });
};

const APPROVED_TEXT_VALIDATORS = [
  validateApprovedTextInputTextFields,
  validateApprovedTextApprovedTextFields,
  validateApprovedTextInputHash,
  validateApprovedTextApprovedHash,
  validateApprovedTextExactMatch,
  validateApprovedTextLengthPolicy,
] as const;

const resolveApprovedTextValidationFailure = (input: { request: ParsedTextInputAbilityInput }) => {
  for (const validator of APPROVED_TEXT_VALIDATORS) {
    const result = validator(input);
    if (result) {
      return result;
    }
  }

  return null;
};

export function validateApprovedText(input: { request: ParsedTextInputAbilityInput }) {
  if (!WRITING_CHILDREN.has(input.request.childCapabilityId)) {
    return buildApprovedTextGatePassResult(0);
  }

  const failure = resolveApprovedTextValidationFailure(input);
  if (failure) {
    return failure;
  }

  return buildApprovedTextGatePassResult((input.request.inputText ?? "").length);
}