import type { ParsedTextInputAbilityInput } from "../contract.js";
import { buildRedactedPreview } from "../shared/text-input-redaction.js";

const WRITE_CHILDREN = new Set(["type-text", "paste-text", "replace-input"]);

const buildSensitiveTextPassResult = (input: {
  redactedPreview: string | null;
  redactionDecision: "hash_only" | "none" | "masked";
}) => ({
  ok: true as const,
  sensitiveTextDecision: "allowed" as const,
  redactionDecision: input.redactionDecision,
  redactedPreview: input.redactedPreview,
  dataQualityFlags: [] as string[],
});

const buildSensitiveTextFailureResult = (input: {
  status: "failed" | "review_required";
  failureReason: "sensitive_text_requires_approval" | null;
  reviewRequiredReason: string | null;
  statusMessage: string;
  policyDecision: "block" | "review_required";
  sensitiveTextDecision: "blocked" | "review_required";
  redactedPreview: string | null;
  dataQualityFlags: string[];
}) => ({
  ok: false as const,
  status: input.status,
  failureReason: input.failureReason,
  reviewRequiredReason: input.reviewRequiredReason,
  statusMessage: input.statusMessage,
  policyDecision: input.policyDecision,
  sensitiveTextDecision: input.sensitiveTextDecision,
  redactionDecision: "masked" as const,
  redactedPreview: input.redactedPreview,
  dataQualityFlags: input.dataQualityFlags,
});

function resolveSensitiveTextPayload(request: ParsedTextInputAbilityInput) {
  return WRITE_CHILDREN.has(request.childCapabilityId) ? (request.inputText ?? "") : "";
}

function resolveSensitiveTextRedactedPreview(input: {
  request: ParsedTextInputAbilityInput;
  payload: string;
}) {
  return input.payload.length > 0
    ? buildRedactedPreview(input.payload, input.request.policy.redactionPolicy.maxPreviewChars)
    : null;
}

function computeRedactionDecision(mode: ParsedTextInputAbilityInput["policy"]["redactionPolicy"]["mode"]) {
  return mode === "hash_only"
    ? ("hash_only" as const)
    : mode === "none"
      ? ("none" as const)
      : ("masked" as const);
}

function validateSensitiveWritePolicy(input: {
  request: ParsedTextInputAbilityInput;
  redactedPreview: string | null;
}) {
  if (input.request.policy.sensitiveTextPolicy.allowSensitiveWrite === true) {
    return null;
  }

  return buildSensitiveTextFailureResult({
    status: "failed",
    failureReason: "sensitive_text_requires_approval",
    reviewRequiredReason: null,
    statusMessage: "Text Input blocked sensitive text because sensitiveTextPolicy.allowSensitiveWrite=false.",
    policyDecision: "block",
    sensitiveTextDecision: "blocked",
    redactedPreview: input.redactedPreview,
    dataQualityFlags: ["sensitive_text_blocked"],
  });
}

function validateSensitiveHumanApproval(input: {
  request: ParsedTextInputAbilityInput;
  redactedPreview: string | null;
}) {
  if (!input.request.policy.sensitiveTextPolicy.requiresHumanApproval || input.request.humanApprovalRef !== null) {
    return null;
  }

  return buildSensitiveTextFailureResult({
    status: "review_required",
    failureReason: null,
    reviewRequiredReason: "Text Input requires humanApprovalRef before writing sensitive text.",
    statusMessage: "Text Input requires humanApprovalRef before writing sensitive text.",
    policyDecision: "review_required",
    sensitiveTextDecision: "review_required",
    redactedPreview: input.redactedPreview,
    dataQualityFlags: ["sensitive_text_missing_human_approval"],
  });
}

function validateSensitiveMapApproval(input: {
  request: ParsedTextInputAbilityInput;
  redactedPreview: string | null;
}) {
  if (!input.request.policy.sensitiveTextPolicy.requiresMapPolicyApproval || input.request.mapPolicyApprovalRef !== null) {
    return null;
  }

  return buildSensitiveTextFailureResult({
    status: "review_required",
    failureReason: null,
    reviewRequiredReason: "Text Input requires mapPolicyApprovalRef before writing sensitive text.",
    statusMessage: "Text Input requires mapPolicyApprovalRef before writing sensitive text.",
    policyDecision: "review_required",
    sensitiveTextDecision: "review_required",
    redactedPreview: input.redactedPreview,
    dataQualityFlags: ["sensitive_text_missing_map_policy_approval"],
  });
}

const SENSITIVE_TEXT_VALIDATORS = [
  validateSensitiveWritePolicy,
  validateSensitiveHumanApproval,
  validateSensitiveMapApproval,
] as const;

function isPolicySensitive(request: ParsedTextInputAbilityInput) {
  return request.policy.sensitiveTextPolicy.classification === "sensitive"
    || request.policy.sensitiveTextPolicy.classification === "restricted";
}

function resolveSensitiveTextValidationFailure(input: {
  request: ParsedTextInputAbilityInput;
  payload: string;
  redactedPreview: string | null;
}) {
  if (input.payload.length === 0 || !isPolicySensitive(input.request)) {
    return null;
  }

  for (const validator of SENSITIVE_TEXT_VALIDATORS) {
    const failure = validator({ request: input.request, redactedPreview: input.redactedPreview });
    if (failure) {
      return failure;
    }
  }

  return null;
}

export function validateSensitiveText(input: { request: ParsedTextInputAbilityInput }) {
  const payload = resolveSensitiveTextPayload(input.request);
  const redactedPreview = resolveSensitiveTextRedactedPreview({ request: input.request, payload });
  const failure = resolveSensitiveTextValidationFailure({
    request: input.request,
    payload,
    redactedPreview,
  });

  if (failure) {
    return failure;
  }

  return buildSensitiveTextPassResult({
    redactedPreview,
    redactionDecision: computeRedactionDecision(input.request.policy.redactionPolicy.mode),
  });
}