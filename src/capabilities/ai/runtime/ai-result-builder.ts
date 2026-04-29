import type { AiAbilityResult, AiChildContract, AiPromptContract, ParsedAiAbilityInput } from "../contract.js";
import type { AiClockEnd, AiClockStart } from "../ports/ai-clock-port.js";
import { AiResultSchema } from "../schema.js";
import { buildStableAiRef } from "../shared/ai-types.js";
import { buildAiRuntimeProof } from "./ai-proof-builder.js";

export function buildAiResult(input: {
  request: ParsedAiAbilityInput;
  childContract: AiChildContract;
  promptContract: AiPromptContract;
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
  dataQualityFlags: string[];
}) {
  const outputRef = buildStableAiRef("ai-output", [input.request.missionId, input.request.sessionId, input.childContract.childCapabilityId, input.request.taskType, input.request.roundId, input.request.videoVisitId]);
  return AiResultSchema.parse({
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
    runtimeProof: buildAiRuntimeProof({
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
      dataQualityFlags: input.dataQualityFlags,
    }),
    promptVersion: input.promptContract.promptVersion,
    schemaVersion: input.promptContract.schemaVersion,
    createdAt: input.createdAt,
  });
}
