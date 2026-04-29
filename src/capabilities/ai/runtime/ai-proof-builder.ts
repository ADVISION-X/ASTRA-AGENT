import type { AiAbilityResult, AiChildContract, AiPromptContract, ParsedAiAbilityInput } from "../contract.js";
import type { AiClockEnd, AiClockStart } from "../ports/ai-clock-port.js";
import { AiRuntimeProofSchema } from "../schema.js";
import { buildStableAiRef } from "../shared/ai-types.js";

export function buildAiRuntimeProof(input: {
  request: ParsedAiAbilityInput;
  childContract: AiChildContract;
  promptContract: AiPromptContract;
  result: Pick<AiAbilityResult, "status" | "failureReason" | "reviewRequiredReason" | "modelProvider" | "modelName" | "modelRole" | "runtime">;
  outputRef: string;
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
  dataQualityFlags: string[];
}) {
  return AiRuntimeProofSchema.parse({
    proofId: buildStableAiRef("ai-proof", [input.request.missionId, input.request.sessionId, input.childContract.childCapabilityId, input.request.taskType, input.request.roundId, input.request.videoVisitId]),
    runId: buildStableAiRef("ai-run", [input.request.sessionId, input.request.taskType, input.request.roundId, input.request.videoVisitId]),
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
    inputRefs: input.request.inputRefs.map((item) => item.id),
    outputRefs: [input.outputRef],
    evidenceRefs: input.request.inputRefs.map((item) => item.id),
    startedAt: input.started.startedAt,
    endedAt: input.ended.endedAt,
    durationMs: input.ended.durationMs,
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
    dataQualityFlags: input.dataQualityFlags,
    clockPortKind: input.ended.portKind,
  });
}
