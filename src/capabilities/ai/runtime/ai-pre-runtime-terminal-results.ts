import type { AiChildContract, AiExecutionContext, ParsedAiAbilityInput } from "../contract.js";
import type { ResolvedAiPromptContract } from "../ports/ai-prompt-registry-port.js";
import { finalizeTerminalResult } from "./ai-terminal-result.js";

function buildRejectedPromptContract(input: {
  request: ParsedAiAbilityInput;
  childContract: AiChildContract;
  reason: string;
}): ResolvedAiPromptContract {
  return {
    promptContractId: input.request.promptContractId,
    promptCatalogVersion: "prompt-catalog-unresolved",
    taskType: input.request.taskType,
    modelRole: input.childContract.modelRole,
    promptId: input.request.promptContractId,
    promptVersion: "unresolved",
    schemaVersion: "unresolved",
    purpose: "Prompt contract resolution failed before runtime execution.",
    forbiddenOutputs: ["platform_action"],
    outputSchemaRef: input.request.expectedOutputSchema,
    requiredInputRefs: ["prompt-contract-resolution"],
    allowedBranchFields: [],
    prohibitedActions: ["click", "scroll", "type", "open_page", "dispatch_action"],
    restrictedDataAccess: ["cookies", "credentials", "hidden_token"],
    confidencePolicy: { minConfidence: 0.6, belowMin: "review_required" },
    reviewPolicy: { requiredWhen: ["prompt_contract_failure"] },
    failurePolicy: {
      badJson: "review_required",
      schemaMismatch: "review_required",
      timeout: "failed",
      modelUnavailable: "failed",
    },
    debugPolicy: { rawOutputRetention: "ref", includePromptHash: true },
    promptHash: `unresolved:${input.request.promptContractId}:${input.reason}`,
  };
}

export const buildAiInputGateFailureResult = (input: {
  request: ParsedAiAbilityInput;
  childContract: AiChildContract;
  context: AiExecutionContext;
  reason: string;
}) =>
  finalizeTerminalResult({
    request: input.request,
    childContract: input.childContract,
    context: input.context,
    promptContract: buildRejectedPromptContract(input),
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

export const buildAiPromptGateFailureResult = (input: {
  request: ParsedAiAbilityInput;
  childContract: AiChildContract;
  context: AiExecutionContext;
  failureReason: string;
  statusMessage: string;
}) =>
  finalizeTerminalResult({
    request: input.request,
    childContract: input.childContract,
    context: input.context,
    promptContract: buildRejectedPromptContract({
      request: input.request,
      childContract: input.childContract,
      reason: input.failureReason,
    }),
    status: "failed",
    failureReason: input.failureReason,
    reviewRequiredReason: null,
    implementationStatus: "prompt_contract_rejected",
    modelProvider: input.childContract.providerKind,
    runtime: "ai-executor",
    modelName: "unavailable",
    confidence: null,
    costEstimate: null,
    schemaValidationStatus: "not_applicable",
    providerDecision: "blocked",
    dataPolicyDecision: "not_applicable",
    costPolicyDecision: "not_applicable",
    safetyPolicyDecision: "allow",
    schemaDecision: "blocked",
    qualityDecision: "blocked",
    outputBoundaryDecision: "allow",
    disabledProviderDecision: "not_applicable",
    dataQualityFlags: [input.failureReason],
    qualityDecisionReason: input.statusMessage,
    output: null,
  });