import type { AiAbilityResult, AiChildContract, AiExecutionContext, ParsedAiAbilityInput } from "../contract.js";
import type { ResolvedAiPromptContract } from "../ports/ai-prompt-registry-port.js";
import { buildAiDisabledProviderOutput } from "./ai-disabled-provider-result.js";
import { evaluateAiCostPolicy } from "./ai-cost-policy-gate.js";
import { evaluateAiDataPolicy } from "./ai-data-policy-gate.js";
import { parseAiExecutorInput } from "./ai-input-gate.js";
import { evaluateAiPayloadBudgetGate } from "./ai-payload-budget-gate.js";
import { evaluateAiProviderPolicy } from "./ai-provider-policy-gate.js";
import { evaluateAiRuntimeHealthGate } from "./ai-runtime-health-gate.js";
import { resolveAiSchemaContract, validateAiInternalCandidate } from "./ai-schema-gate.js";
import { finalizeTerminalResult } from "./ai-terminal-result.js";

type AiExecutionSeed = {
  request: ParsedAiAbilityInput;
  childContract: AiChildContract;
  context: AiExecutionContext;
  promptContract: ResolvedAiPromptContract;
};

export type AiExecutionPlan = AiExecutionSeed & {
  providerDecision: ReturnType<typeof evaluateAiProviderPolicy>;
  dataDecision: ReturnType<typeof evaluateAiDataPolicy>;
  costDecision: ReturnType<typeof evaluateAiCostPolicy>;
  payloadBudgetDecision: ReturnType<typeof evaluateAiPayloadBudgetGate>;
  resolvedSchema: ReturnType<typeof resolveAiSchemaContract>;
};

const buildUnavailableTerminalResult = (
  plan: AiExecutionPlan,
  input: {
    status: AiAbilityResult["status"];
    failureReason: string | null;
    reviewRequiredReason: string | null;
    implementationStatus: string;
    schemaValidationStatus: AiAbilityResult["schemaValidationStatus"];
    qualityDecision: AiAbilityResult["runtimeProof"]["qualityDecision"];
    disabledProviderDecision: AiAbilityResult["runtimeProof"]["disabledProviderDecision"];
    dataQualityFlags: string[];
    qualityDecisionReason?: string | null;
  },
) =>
  finalizeTerminalResult({
    request: plan.request,
    childContract: plan.childContract,
    context: plan.context,
    promptContract: plan.promptContract,
    status: input.status,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    implementationStatus: input.implementationStatus,
    modelProvider: plan.childContract.providerKind,
    runtime: "ai-executor",
    modelName: "unavailable",
    confidence: null,
    costEstimate: null,
    schemaValidationStatus: input.schemaValidationStatus,
    providerDecision: plan.providerDecision.decision,
    dataPolicyDecision: plan.dataDecision.decision,
    costPolicyDecision: plan.costDecision.decision,
    safetyPolicyDecision: "allow",
    schemaDecision: plan.resolvedSchema.decision,
    qualityDecision: input.qualityDecision,
    outputBoundaryDecision: "allow",
    disabledProviderDecision: input.disabledProviderDecision,
    dataQualityFlags: input.dataQualityFlags,
    output: null,
    ...(input.qualityDecisionReason === undefined ? {} : { qualityDecisionReason: input.qualityDecisionReason }),
  });

export const buildAiInputGateFailureResult = (input: {
  request: ParsedAiAbilityInput;
  childContract: AiChildContract;
  context: AiExecutionContext;
  promptContract: ResolvedAiPromptContract;
  reason: string;
}) =>
  finalizeTerminalResult({
    request: input.request,
    childContract: input.childContract,
    context: input.context,
    promptContract: input.promptContract,
    status: "failed",
    failureReason: input.reason,
    reviewRequiredReason: null,
    implementationStatus: "input_gate_blocked",
    modelProvider: input.childContract.providerKind,
    runtime: "ai-executor",
    modelName: "unavailable",
    confidence: null,
    costEstimate: null,
    schemaValidationStatus: "invalid",
    providerDecision: "blocked",
    dataPolicyDecision: "not_applicable",
    costPolicyDecision: "not_applicable",
    safetyPolicyDecision: "allow",
    schemaDecision: "blocked",
    qualityDecision: "blocked",
    outputBoundaryDecision: "allow",
    disabledProviderDecision: "not_applicable",
    dataQualityFlags: [input.reason],
    output: null,
  });

const buildAiDisabledProviderResult = (plan: AiExecutionPlan) => {
  const disabledOutput = buildAiDisabledProviderOutput(plan.request, plan.childContract, plan.promptContract);
  return finalizeTerminalResult({
    request: plan.request,
    childContract: plan.childContract,
    context: plan.context,
    promptContract: plan.promptContract,
    status: "failed",
    failureReason: "provider_disabled",
    reviewRequiredReason: null,
    implementationStatus: disabledOutput.implementationStatus,
    modelProvider: disabledOutput.modelProvider,
    runtime: disabledOutput.runtime,
    modelName: disabledOutput.modelName,
    confidence: null,
    costEstimate: null,
    schemaValidationStatus: "not_applicable",
    providerDecision: plan.providerDecision.decision,
    dataPolicyDecision: "not_applicable",
    costPolicyDecision: "not_applicable",
    safetyPolicyDecision: "allow",
    schemaDecision: plan.resolvedSchema.decision,
    qualityDecision: "blocked",
    outputBoundaryDecision: "allow",
    disabledProviderDecision: "disabled",
    dataQualityFlags: ["provider_disabled"],
    output: null,
  });
};

const buildAiPolicyGateBlockedResult = (plan: AiExecutionPlan, reason: string) =>
  buildUnavailableTerminalResult(plan, {
    status: "failed",
    failureReason: reason,
    reviewRequiredReason: null,
    implementationStatus: "policy_gate_blocked",
    schemaValidationStatus: plan.resolvedSchema.decision === "blocked" ? "invalid" : "not_applicable",
    qualityDecision: "blocked",
    disabledProviderDecision: "not_applicable",
    dataQualityFlags: [reason, ...plan.payloadBudgetDecision.flags],
  });

const buildAiPolicyGateReviewResult = (plan: AiExecutionPlan, reason: string) =>
  buildUnavailableTerminalResult(plan, {
    status: "review_required",
    failureReason: null,
    reviewRequiredReason: reason,
    implementationStatus: "policy_gate_review_required",
    schemaValidationStatus: "not_applicable",
    qualityDecision: "review_required",
    disabledProviderDecision: "not_applicable",
    dataQualityFlags: [reason],
    qualityDecisionReason: reason,
  });

const buildAiInternalValidationFailedResult = (plan: AiExecutionPlan, issues: string[]) =>
  finalizeTerminalResult({
    request: plan.request,
    childContract: plan.childContract,
    context: plan.context,
    promptContract: plan.promptContract,
    status: plan.request.safetyPolicy.reviewOnSchemaFailure ? "review_required" : "failed",
    failureReason: plan.request.safetyPolicy.reviewOnSchemaFailure ? null : "internal_validation_failed",
    reviewRequiredReason: plan.request.safetyPolicy.reviewOnSchemaFailure ? "internal_validation_failed" : null,
    implementationStatus: "internal_schema_validation_failed",
    modelProvider: "internal",
    runtime: "internal-schema-validator",
    modelName: "schema-validator",
    confidence: 1,
    costEstimate: 0,
    schemaValidationStatus: "invalid",
    providerDecision: plan.providerDecision.decision,
    dataPolicyDecision: plan.dataDecision.decision,
    costPolicyDecision: plan.costDecision.decision,
    safetyPolicyDecision: "allow",
    schemaDecision: "review_required",
    qualityDecision: plan.request.safetyPolicy.reviewOnSchemaFailure ? "review_required" : "blocked",
    outputBoundaryDecision: "allow",
    disabledProviderDecision: "not_applicable",
    dataQualityFlags: issues,
    output: null,
    schemaIssueCount: issues.length,
    qualityDecisionReason: "internal_validation_failed",
  });

const buildAiInternalValidationSuccessResult = (
  plan: AiExecutionPlan,
  output: { valid: true; issues: string[] },
) =>
  finalizeTerminalResult({
    request: plan.request,
    childContract: plan.childContract,
    context: plan.context,
    promptContract: plan.promptContract,
    status: "success",
    failureReason: null,
    reviewRequiredReason: null,
    implementationStatus: "internal_schema_validated",
    modelProvider: "internal",
    runtime: "internal-schema-validator",
    modelName: "schema-validator",
    confidence: 1,
    costEstimate: 0,
    schemaValidationStatus: "valid",
    providerDecision: plan.providerDecision.decision,
    dataPolicyDecision: plan.dataDecision.decision,
    costPolicyDecision: plan.costDecision.decision,
    safetyPolicyDecision: "allow",
    schemaDecision: "resolved",
    qualityDecision: "pass",
    outputBoundaryDecision: "allow",
    disabledProviderDecision: "not_applicable",
    dataQualityFlags: [],
    output,
  });

const buildAiRuntimeHealthBlockedResult = (
  plan: AiExecutionPlan,
  runtimeHealthDecision: Awaited<ReturnType<typeof evaluateAiRuntimeHealthGate>>,
) => {
  const reason = runtimeHealthDecision.reason ?? "runtime_health_blocked";
  return buildUnavailableTerminalResult(plan, {
    status: runtimeHealthDecision.decision === "review_required" ? "review_required" : "failed",
    failureReason: runtimeHealthDecision.decision === "blocked" ? reason : null,
    reviewRequiredReason: runtimeHealthDecision.decision === "review_required" ? reason : null,
    implementationStatus: "runtime_health_gate_blocked",
    schemaValidationStatus: "not_applicable",
    qualityDecision: runtimeHealthDecision.decision === "review_required" ? "review_required" : "blocked",
    disabledProviderDecision: "not_applicable",
    dataQualityFlags: [reason],
    qualityDecisionReason: reason,
  });
};

const resolveAiPolicyReason = (plan: AiExecutionPlan, fallbackReason: string) =>
  plan.providerDecision.reason
  ?? plan.dataDecision.reason
  ?? plan.costDecision.reason
  ?? plan.resolvedSchema.reason
  ?? plan.payloadBudgetDecision.reason
  ?? fallbackReason;

const hasBlockedPreRuntimeDecision = (plan: AiExecutionPlan) =>
  plan.providerDecision.decision === "blocked"
  || plan.resolvedSchema.decision === "blocked"
  || plan.dataDecision.decision === "blocked"
  || plan.costDecision.decision === "blocked"
  || plan.payloadBudgetDecision.decision === "blocked";

const hasReviewRequiredPreRuntimeDecision = (plan: AiExecutionPlan) =>
  plan.providerDecision.decision === "review_required"
  || plan.dataDecision.decision === "review_required"
  || plan.costDecision.decision === "review_required";

export const buildAiExecutionPlan = (input: AiExecutionSeed): AiExecutionPlan => ({
  ...input,
  providerDecision: evaluateAiProviderPolicy(input.request, input.childContract),
  dataDecision: evaluateAiDataPolicy(input.request, input.childContract),
  costDecision: evaluateAiCostPolicy(input.request, input.childContract),
  payloadBudgetDecision: evaluateAiPayloadBudgetGate(input.request),
  resolvedSchema: ({ decision: "resolved", reason: null, schemaId: "mutated", outputSchema: null }),
});

export async function resolveAiPreRuntimeResult(plan: AiExecutionPlan): Promise<AiAbilityResult | null> {
  if (plan.providerDecision.decision === "disabled") {
    return buildAiDisabledProviderResult(plan);
  }
  if (hasBlockedPreRuntimeDecision(plan)) {
    return buildAiPolicyGateBlockedResult(plan, resolveAiPolicyReason(plan, "provider_policy_blocked"));
  }
  if (hasReviewRequiredPreRuntimeDecision(plan)) {
    return buildAiPolicyGateReviewResult(plan, resolveAiPolicyReason(plan, "provider_policy_blocked"));
  }
  if (plan.childContract.providerKind === "internal") {
    const validation = validateAiInternalCandidate(plan.request, plan.promptContract);
    return validation.valid
      ? buildAiInternalValidationSuccessResult(plan, validation.output)
      : buildAiInternalValidationFailedResult(plan, validation.issues);
  }

  const runtimeHealthDecision = await evaluateAiRuntimeHealthGate({
    request: plan.request,
    context: plan.context,
  });
  return runtimeHealthDecision.decision === "allow"
    ? null
    : buildAiRuntimeHealthBlockedResult(plan, runtimeHealthDecision);
}

export const runAiExecutorInputGate = (
  request: ParsedAiAbilityInput,
  childCapabilityId: AiChildContract["childCapabilityId"],
) => parseAiExecutorInput(request, childCapabilityId);