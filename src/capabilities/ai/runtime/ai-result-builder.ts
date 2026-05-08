import type { AiAbilityResult, AiChildContract, ParsedAiAbilityInput } from "../contract.js";
import type { AiClockEnd, AiClockStart } from "../ports/ai-clock-port.js";
import type { ResolvedAiPromptContract } from "../ports/ai-prompt-registry-port.js";
import { AiResultSchema } from "../schema.js";
import { buildStableAiRef } from "../shared/ai-types.js";
import { buildAiRuntimeProof } from "./ai-proof-builder.js";
import { recordAiOutputSummary } from "./ai-output-summary-registry.js";

function resolveAiOutputRef(input: {
  request: ParsedAiAbilityInput;
  childContract: AiChildContract;
  status: AiAbilityResult["status"];
  output: AiAbilityResult["output"];
}): string | null {
  if (input.status !== "success" || input.output === null) {
    return null;
  }
  return buildStableAiRef("ai-output", [input.request.missionId, input.request.sessionId, input.childContract.childCapabilityId, input.request.taskType, input.request.roundId, input.request.videoVisitId]);
}

function buildAiResultProof(input: Parameters<typeof buildAiResult>[0], outputRef: string | null) {
  return buildAiRuntimeProof({
    request: input.request,
    childContract: input.childContract,
    promptContract: input.promptContract,
    result: {
      status: input.status,
      failureReason: input.failureReason,
      reviewRequiredReason: input.reviewRequiredReason,
      modelProvider: input.modelProvider,
      modelName: input.modelName,
      modelRole: input.modelRole,
      runtime: input.runtime,
    },
    outputRef,
    started: input.started,
    ended: input.ended,
    providerDecision: input.providerDecision,
    dataPolicyDecision: input.dataPolicyDecision,
    costPolicyDecision: input.costPolicyDecision,
    safetyPolicyDecision: input.safetyPolicyDecision,
    schemaDecision: input.schemaDecision,
    qualityDecision: input.qualityDecision,
    outputBoundaryDecision: input.outputBoundaryDecision,
    disabledProviderDecision: input.disabledProviderDecision,
    rawOutputRef: input.rawOutputRef,
    rawOutputHash: input.rawOutputHash,
    runtimeCallId: input.runtimeCallId,
    timeoutMs: input.timeoutMs,
    attemptIndex: input.attemptIndex,
    retryCount: input.retryCount,
    circuitBreakerState: input.circuitBreakerState,
    gatewayDurationMs: input.gatewayDurationMs,
    schemaIssueCount: input.schemaIssueCount,
    boundaryViolationCount: input.boundaryViolationCount,
    qualityDecisionReason: input.qualityDecisionReason,
    dataQualityFlags: input.dataQualityFlags,
  });
}

export function buildAiResult(input: {
  request: ParsedAiAbilityInput;
  childContract: AiChildContract;
  promptContract: ResolvedAiPromptContract;
  status: AiAbilityResult["status"];
  modelProvider: AiAbilityResult["modelProvider"];
  modelName: string;
  modelRole: AiAbilityResult["modelRole"];
  runtime: string;
  implementationStatus: string;
  outputAuthority: AiAbilityResult["outputAuthority"];
  output: AiAbilityResult["output"];
  rawOutputRef: string | null;
  schemaValidationStatus: AiAbilityResult["schemaValidationStatus"];
  confidence: number | null;
  failureReason: string | null;
  reviewRequiredReason: string | null;
  costEstimate: number | null;
  createdAt: string;
  started: AiClockStart;
  ended: AiClockEnd;
  providerDecision: AiAbilityResult["runtimeProof"]["providerDecision"];
  dataPolicyDecision: AiAbilityResult["runtimeProof"]["dataPolicyDecision"];
  costPolicyDecision: AiAbilityResult["runtimeProof"]["costPolicyDecision"];
  safetyPolicyDecision: AiAbilityResult["runtimeProof"]["safetyPolicyDecision"];
  schemaDecision: AiAbilityResult["runtimeProof"]["schemaDecision"];
  qualityDecision: AiAbilityResult["runtimeProof"]["qualityDecision"];
  outputBoundaryDecision: AiAbilityResult["runtimeProof"]["outputBoundaryDecision"];
  disabledProviderDecision: AiAbilityResult["runtimeProof"]["disabledProviderDecision"];
  rawOutputHash: string | null;
  runtimeCallId: string | null;
  timeoutMs: number | null;
  attemptIndex: number;
  retryCount: number;
  circuitBreakerState: AiAbilityResult["runtimeProof"]["circuitBreakerState"];
  gatewayDurationMs: number | null;
  schemaIssueCount: number;
  boundaryViolationCount: number;
  qualityDecisionReason: string | null;
  dataQualityFlags: string[];
}) {
  const outputRef = resolveAiOutputRef(input);

  const result = AiResultSchema.parse({
    status: input.status,
    abilityGroupId: "ai",
    childCapabilityId: input.childContract.childCapabilityId,
    taskType: input.request.taskType,
    modelProvider: input.modelProvider,
    modelName: input.modelName,
    modelRole: input.modelRole,
    runtime: input.runtime,
    implementationStatus: input.implementationStatus,
    outputAuthority: input.outputAuthority,
    output: input.output,
    rawOutputRef: input.rawOutputRef,
    schemaValidationStatus: input.schemaValidationStatus,
    confidence: input.confidence,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    durationMs: input.ended.durationMs,
    costEstimate: input.costEstimate,
    evidenceRefs: input.request.inputRefs,
    debugLogRef: null,
    runtimeProof: buildAiResultProof(input, outputRef),
    promptVersion: input.promptContract.promptVersion,
    schemaVersion: input.promptContract.schemaVersion,
    createdAt: input.createdAt,
  });

  recordAiOutputSummary({ outputRef, request: input.request, result });
  return result;
}
