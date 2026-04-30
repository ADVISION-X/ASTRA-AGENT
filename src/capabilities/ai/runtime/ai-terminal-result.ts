import type { AiAbilityResult, AiChildContract, AiExecutionContext, ParsedAiAbilityInput } from "../contract.js";
import type { ResolvedAiPromptContract } from "../ports/ai-prompt-registry-port.js";
import { buildAiResult } from "./ai-result-builder.js";

export type AiTerminalResultInput = {
  request: ParsedAiAbilityInput;
  childContract: AiChildContract;
  context: AiExecutionContext;
  promptContract: ResolvedAiPromptContract;
  status: AiAbilityResult["status"];
  failureReason: string | null;
  reviewRequiredReason: string | null;
  implementationStatus: string;
  modelProvider: AiAbilityResult["modelProvider"];
  runtime: string;
  modelName: string;
  confidence: number | null;
  costEstimate: number | null;
  schemaValidationStatus: AiAbilityResult["schemaValidationStatus"];
  providerDecision: AiAbilityResult["runtimeProof"]["providerDecision"];
  dataPolicyDecision: AiAbilityResult["runtimeProof"]["dataPolicyDecision"];
  costPolicyDecision: AiAbilityResult["runtimeProof"]["costPolicyDecision"];
  safetyPolicyDecision: AiAbilityResult["runtimeProof"]["safetyPolicyDecision"];
  schemaDecision: AiAbilityResult["runtimeProof"]["schemaDecision"];
  qualityDecision: AiAbilityResult["runtimeProof"]["qualityDecision"];
  outputBoundaryDecision: AiAbilityResult["runtimeProof"]["outputBoundaryDecision"];
  disabledProviderDecision: AiAbilityResult["runtimeProof"]["disabledProviderDecision"];
  dataQualityFlags: string[];
  output: AiAbilityResult["output"];
  rawOutputRef?: string | null;
  rawOutputHash?: string | null;
  runtimeCallId?: string | null;
  timeoutMs?: number | null;
  attemptIndex?: number;
  retryCount?: number;
  circuitBreakerState?: AiAbilityResult["runtimeProof"]["circuitBreakerState"];
  gatewayDurationMs?: number | null;
  schemaIssueCount?: number;
  boundaryViolationCount?: number;
  qualityDecisionReason?: string | null;
  createdAt?: string | null;
};

const buildAiTerminalBase = (
  input: AiTerminalResultInput,
  started: ReturnType<AiExecutionContext["clock"]["startRun"]>,
  ended: ReturnType<AiExecutionContext["clock"]["finishRun"]>,
) => ({
  request: input.request,
  childContract: input.childContract,
  promptContract: input.promptContract,
  status: input.status,
  modelProvider: input.modelProvider,
  modelName: input.modelName,
  modelRole: input.promptContract.modelRole,
  runtime: input.runtime,
  implementationStatus: input.implementationStatus,
  outputAuthority: input.status === "success" ? "authoritative" : "non_authoritative",
  output: input.status === "success" ? input.output : null,
  rawOutputRef: input.rawOutputRef ?? null,
  schemaValidationStatus: input.schemaValidationStatus,
  confidence: input.confidence,
  failureReason: input.failureReason,
  reviewRequiredReason: input.reviewRequiredReason,
  costEstimate: input.costEstimate,
  createdAt: input.createdAt ?? ended.endedAt,
  started,
  ended,
  providerDecision: input.providerDecision,
  dataPolicyDecision: input.dataPolicyDecision,
  costPolicyDecision: input.costPolicyDecision,
  safetyPolicyDecision: input.safetyPolicyDecision,
  schemaDecision: input.schemaDecision,
  qualityDecision: input.qualityDecision,
  outputBoundaryDecision: input.outputBoundaryDecision,
  disabledProviderDecision: input.disabledProviderDecision,
});

const buildAiTerminalRuntimeMetadata = (input: AiTerminalResultInput) => ({
  rawOutputHash: input.rawOutputHash ?? null,
  runtimeCallId: input.runtimeCallId ?? null,
  timeoutMs: input.timeoutMs ?? null,
  attemptIndex: input.attemptIndex ?? 0,
  retryCount: input.retryCount ?? 0,
  circuitBreakerState: input.circuitBreakerState ?? "not_applicable",
  gatewayDurationMs: input.gatewayDurationMs ?? null,
  schemaIssueCount: input.schemaIssueCount ?? 0,
  boundaryViolationCount: input.boundaryViolationCount ?? 0,
  qualityDecisionReason: input.qualityDecisionReason ?? null,
  dataQualityFlags: input.dataQualityFlags,
});

export function finalizeTerminalResult(input: AiTerminalResultInput) {
  const started = input.context.clock.startRun();
  const ended = input.context.clock.finishRun(started);
  return buildAiResult({
    ...buildAiTerminalBase(input, started, ended),
    ...buildAiTerminalRuntimeMetadata(input),
  });
}