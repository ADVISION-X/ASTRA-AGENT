import { createHash } from "node:crypto";

import type { AiAbilityResult, AiChildContract, ParsedAiAbilityInput } from "../contract.js";
import type { AiClockEnd, AiClockStart } from "../ports/ai-clock-port.js";
import type { ResolvedAiPromptContract } from "../ports/ai-prompt-registry-port.js";
import { AiRuntimeProofSchema } from "../schema.js";
import { buildStableAiRef } from "../shared/ai-types.js";

function hashValue(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function buildAiRequestHash(request: ParsedAiAbilityInput): string {
  return hashValue({
    sessionId: request.sessionId,
    roundId: request.roundId,
    videoVisitId: request.videoVisitId,
    taskType: request.taskType,
    promptContractId: request.promptContractId,
  });
}

function buildAiModelConfigHash(input: {
  childContract: AiChildContract;
  result: Pick<AiAbilityResult, "modelName" | "modelRole">;
}): string {
  return hashValue({
    childCapabilityId: input.childContract.childCapabilityId,
    providerKind: input.childContract.providerKind,
    modelName: input.result.modelName,
    modelRole: input.result.modelRole,
  });
}

function buildAiProofIds(input: {
  request: ParsedAiAbilityInput;
  childContract: AiChildContract;
}) {
  return {
    proofId: buildStableAiRef("ai-proof", [input.request.missionId, input.request.sessionId, input.childContract.childCapabilityId, input.request.taskType, input.request.roundId, input.request.videoVisitId]),
    runId: buildStableAiRef("ai-run", [input.request.sessionId, input.request.taskType, input.request.roundId, input.request.videoVisitId]),
  };
}

function buildAiRuntimeProofPayload(input: Parameters<typeof buildAiRuntimeProof>[0]) {
  const proofIds = buildAiProofIds(input);
  return {
    proofId: proofIds.proofId,
    runId: proofIds.runId,
    missionId: input.request.missionId,
    missionIdSource: input.request.missionId === null ? "unavailable" : "explicit",
    sessionId: input.request.sessionId,
    roundId: input.request.roundId,
    videoVisitId: input.request.videoVisitId,
    abilityGroupId: "ai",
    childCapabilityId: input.childContract.childCapabilityId,
    taskType: input.request.taskType,
    promptContractId: input.request.promptContractId,
    expectedOutputSchema: input.request.expectedOutputSchema,
    modelProvider: input.result.modelProvider,
    modelName: input.result.modelName,
    modelRole: input.result.modelRole,
    runtime: input.result.runtime,
    requestHash: buildAiRequestHash(input.request),
    inputPayloadHash: hashValue(input.request.input),
    promptContractHash: input.promptContract.promptHash,
    modelConfigHash: buildAiModelConfigHash({ childContract: input.childContract, result: input.result }),
    runtimeCallId: input.runtimeCallId,
    inputRefs: input.request.inputRefs.map((item) => item.id),
    outputRefs: input.outputRef ? [input.outputRef] : [],
    evidenceRefs: input.request.inputRefs.map((item) => item.id),
    rawOutputRef: input.rawOutputRef,
    rawOutputHash: input.rawOutputHash,
    timeoutMs: input.timeoutMs,
    attemptIndex: input.attemptIndex,
    retryCount: input.retryCount,
    circuitBreakerState: input.circuitBreakerState,
    gatewayDurationMs: input.gatewayDurationMs,
    startedAt: input.started.startedAt,
    endedAt: input.ended.endedAt,
    durationMs: input.ended.durationMs,
    ...buildAiRuntimeProofOutcome(input),
    clockPortKind: input.ended.portKind,
  };
}

function buildAiRuntimeProofOutcome(input: Parameters<typeof buildAiRuntimeProof>[0]) {
  return {
    status: input.result.status,
    failureReason: input.result.failureReason,
    reviewRequiredReason: input.result.reviewRequiredReason,
    providerDecision: input.providerDecision,
    dataPolicyDecision: input.dataPolicyDecision,
    costPolicyDecision: input.costPolicyDecision,
    safetyPolicyDecision: input.safetyPolicyDecision,
    schemaDecision: input.schemaDecision,
    qualityDecision: input.qualityDecision,
    outputBoundaryDecision: input.outputBoundaryDecision,
    disabledProviderDecision: input.disabledProviderDecision,
    schemaIssueCount: input.schemaIssueCount,
    boundaryViolationCount: input.boundaryViolationCount,
    qualityDecisionReason: input.qualityDecisionReason,
    dataQualityFlags: input.dataQualityFlags,
  };
}

export function buildAiRuntimeProof(input: {
  request: ParsedAiAbilityInput;
  childContract: AiChildContract;
  promptContract: ResolvedAiPromptContract;
  result: Pick<AiAbilityResult, "status" | "failureReason" | "reviewRequiredReason" | "modelProvider" | "modelName" | "modelRole" | "runtime">;
  outputRef: string | null;
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
  rawOutputRef: string | null;
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
  return AiRuntimeProofSchema.parse(buildAiRuntimeProofPayload(input));
}
