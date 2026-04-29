import type {
  AiAbilityInput,
  AiAbilityResult,
  AiChildCapabilityId,
  AiExecutionStatus,
  AiPromptContract,
  AiSchemaValidationStatus,
} from "../contract.js";
import { validateAiAbilityResult } from "../schema-validation.js";
import { buildAiRuntimeProof } from "./ai-runtime-proof-builder.js";

export type BuildAiExecutionResultInput = {
  request: AiAbilityInput;
  childCapabilityId: AiChildCapabilityId;
  promptContract: AiPromptContract;
  modelProvider: AiAbilityResult["modelProvider"];
  modelName: string;
  runtime: string;
  implementationStatus: string;
  output: AiAbilityResult["output"];
  status: AiExecutionStatus;
  schemaValidationStatus: AiSchemaValidationStatus;
  confidence: number | null;
  failureReason: string | null;
  reviewRequiredReason: string | null;
  startedAt: string;
  endedAt: string;
  dataQualityFlags: string[];
  reason: string;
  createdAt: string;
  outputRefs?: string[];
};

export function buildAiExecutionResult(input: BuildAiExecutionResultInput): AiAbilityResult {
  const durationMs = Math.max(0, new Date(input.endedAt).getTime() - new Date(input.startedAt).getTime());
  return validateAiAbilityResult({
    status: input.status,
    abilityGroupId: "ai",
    childCapabilityId: input.childCapabilityId,
    taskType: input.request.taskType,
    modelProvider: input.modelProvider,
    modelName: input.modelName,
    modelRole: input.promptContract.modelRole,
    runtime: input.runtime,
    implementationStatus: input.implementationStatus,
    output: input.output,
    rawOutputRef: null,
    schemaValidationStatus: input.schemaValidationStatus,
    confidence: input.confidence,
    failureReason: input.failureReason,
    durationMs,
    costEstimate: null,
    evidenceRefs: input.request.inputRefs,
    debugLogRef: null,
    runtimeProof: buildAiRuntimeProof({
      request: input.request,
      childCapabilityId: input.childCapabilityId,
      status: input.status,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      reason: input.reason,
      failureReason: input.failureReason,
      reviewRequiredReason: input.reviewRequiredReason,
      dataQualityFlags: input.dataQualityFlags,
      ...(input.outputRefs ? { outputRefs: input.outputRefs } : {}),
    }),
    promptVersion: input.promptContract.promptVersion,
    schemaVersion: input.promptContract.schemaVersion,
    createdAt: input.createdAt,
  });
}