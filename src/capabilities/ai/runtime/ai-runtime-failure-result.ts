import type { AiAbilityInput, AiAbilityResult, AiChildCapabilityId, AiPromptContract, AiSchemaValidationStatus } from "../contract.js";
import { describeLocalAiFailure } from "../shared/ai-failure.js";
import { isLocalAiChildCapabilityId } from "../shared/ai-policy.js";
import { buildDefaultAiOutput } from "./ai-runtime-output-normalizer.js";
import { buildAiExecutionResult } from "./ai-runtime-result-builder.js";

function getModelProviderForChildCapabilityId(childCapabilityId: AiChildCapabilityId): AiAbilityResult["modelProvider"] {
  if (childCapabilityId === "future-api-ai") {
    return "future";
  }
  if (childCapabilityId === "internal-schema-validator") {
    return "internal";
  }
  if (!isLocalAiChildCapabilityId(childCapabilityId)) {
    return "paid";
  }

  return "local";
}

export function buildAiPolicyFailureResult(input: {
  request: AiAbilityInput;
  promptContract: AiPromptContract;
  childCapabilityId: AiChildCapabilityId;
  startedAt: string;
  reasons: string[];
  implementationStatus?: string;
  reason?: string;
}): AiAbilityResult {
  const endedAt = new Date().toISOString();
  const failureReason = input.reasons.join(" ");
  const status = input.request.safetyPolicy.reviewOnPolicyViolation ? "review_required" : "failed";

  return buildAiExecutionResult({
    request: input.request,
    childCapabilityId: input.childCapabilityId,
    promptContract: input.promptContract,
    modelProvider: getModelProviderForChildCapabilityId(input.childCapabilityId),
    modelName: "policy-gate",
    runtime: "governed-gate",
    implementationStatus: input.implementationStatus ?? "disabled_by_policy",
    output: buildDefaultAiOutput(input.request, failureReason),
    status,
    schemaValidationStatus: "not_applicable",
    confidence: null,
    failureReason,
    reviewRequiredReason: status === "review_required" ? failureReason : null,
    startedAt: input.startedAt,
    endedAt,
    dataQualityFlags: ["policy_violation"],
    reason: input.reason ?? "policy_gate_blocked_execution",
    createdAt: endedAt,
  });
}

export function buildAiRuntimeFailureResult(input: {
  request: AiAbilityInput;
  promptContract: AiPromptContract;
  childCapabilityId: AiChildCapabilityId;
  startedAt: string;
  error: unknown;
}): AiAbilityResult {
  const failure = describeLocalAiFailure(input.error);
  const endedAt = new Date().toISOString();
  const status = failure.decision === "invalid_ai_output" && input.request.safetyPolicy.reviewOnSchemaFailure
    ? "review_required"
    : "failed";
  const schemaValidationStatus: AiSchemaValidationStatus = failure.decision === "invalid_ai_output" ? "invalid" : "not_applicable";
  const dataQualityFlags = failure.decision === "invalid_ai_output" ? ["schema_invalid"] : [failure.localAiStatus];

  return buildAiExecutionResult({
    request: input.request,
    childCapabilityId: input.childCapabilityId,
    promptContract: input.promptContract,
    modelProvider: getModelProviderForChildCapabilityId(input.childCapabilityId),
    modelName: "local-runtime-error",
    runtime: "local-wrapper",
    implementationStatus: failure.localAiStatus,
    output: buildDefaultAiOutput(input.request, failure.reason),
    status,
    schemaValidationStatus,
    confidence: null,
    failureReason: failure.reason,
    reviewRequiredReason: status === "review_required" ? failure.reason : null,
    startedAt: input.startedAt,
    endedAt,
    dataQualityFlags,
    reason: failure.eventType,
    createdAt: endedAt,
  });
}

export function buildAiDispatchFailureResult(input: {
  request: AiAbilityInput;
  promptContract: AiPromptContract;
  childCapabilityId: AiChildCapabilityId;
  startedAt: string;
  failureReason: string;
  implementationStatus?: string;
  reason?: string;
}): AiAbilityResult {
  const endedAt = new Date().toISOString();

  return buildAiExecutionResult({
    request: input.request,
    childCapabilityId: input.childCapabilityId,
    promptContract: input.promptContract,
    modelProvider: getModelProviderForChildCapabilityId(input.childCapabilityId),
    modelName: "dispatch-guard",
    runtime: "ability-group-dispatch",
    implementationStatus: input.implementationStatus ?? "dispatch_failure",
    output: buildDefaultAiOutput(input.request, input.failureReason),
    status: "failed",
    schemaValidationStatus: "not_applicable",
    confidence: null,
    failureReason: input.failureReason,
    reviewRequiredReason: null,
    startedAt: input.startedAt,
    endedAt,
    dataQualityFlags: ["dispatch_failure"],
    reason: input.reason ?? "ability_group_dispatch_failed",
    createdAt: endedAt,
  });
}