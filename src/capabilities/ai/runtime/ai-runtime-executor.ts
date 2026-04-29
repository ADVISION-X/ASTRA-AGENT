import type { AiAbilityInput, AiAbilityResult, AiChildCapabilityId, AiExecutionOptions, AiPromptContract } from "../contract.js";
import { assertAiReadOnlyBoundary } from "../shared/ai-policy.js";
import { buildAiRuntimeFailureResult, buildAiPolicyFailureResult } from "./ai-runtime-failure-result.js";
import { buildDefaultAiOutput, toPublicAiOutput } from "./ai-runtime-output-normalizer.js";
import { collectAiOutputBoundaryViolations, collectAiRuntimePolicyViolations } from "./ai-runtime-policy-gate.js";
import { evaluateAiQualityGate } from "./ai-runtime-quality-gate.js";
import { buildAiExecutionResult } from "./ai-runtime-result-builder.js";
import { inspectAiOutputSchema } from "./ai-runtime-schema-gate.js";

export type AiGatewayExecutionResult = {
  taskType: string;
  runtime: string;
  model: string;
  implementationStatus: string;
  confidence: number;
  createdAt: string;
  result: unknown;
};

export async function executeAiLocalRuntimeRequest(input: {
  request: AiAbilityInput;
  childCapabilityId: AiChildCapabilityId;
  promptContract: AiPromptContract;
  options?: AiExecutionOptions;
  executeGateway: (options?: AiExecutionOptions) => Promise<AiGatewayExecutionResult>;
}): Promise<AiAbilityResult> {
  const startedAt = new Date().toISOString();
  const policyViolations = collectAiRuntimePolicyViolations({
    request: input.request,
    childCapabilityId: input.childCapabilityId,
    promptContract: input.promptContract,
  });

  if (policyViolations.length > 0) {
    return buildAiPolicyFailureResult({
      request: input.request,
      promptContract: input.promptContract,
      childCapabilityId: input.childCapabilityId,
      startedAt,
      reasons: policyViolations,
    });
  }

  try {
    assertAiReadOnlyBoundary(input.promptContract.purpose);
    const gatewayResult = await input.executeGateway(input.options);
    const publicOutput = toPublicAiOutput({
      taskType: input.request.taskType,
      result: gatewayResult.result,
    });
    const outputSchema = inspectAiOutputSchema({
      request: input.request,
      output: publicOutput,
    });
    const boundaryViolations = collectAiOutputBoundaryViolations(publicOutput);
    const qualityDecision = evaluateAiQualityGate({
      request: input.request,
      policyViolations: boundaryViolations,
      schemaIssues: outputSchema.issues,
      confidence: gatewayResult.confidence,
    });
    const primaryReason = qualityDecision.primaryReason;
    const endedAt = new Date().toISOString();

    return buildAiExecutionResult({
      request: input.request,
      childCapabilityId: input.childCapabilityId,
      promptContract: input.promptContract,
      modelProvider: "local",
      modelName: gatewayResult.model,
      runtime: gatewayResult.runtime,
      implementationStatus: gatewayResult.implementationStatus,
      output: outputSchema.normalizedOutput ?? buildDefaultAiOutput(input.request, primaryReason ?? gatewayResult.implementationStatus),
      status: qualityDecision.status,
      schemaValidationStatus: qualityDecision.schemaValidationStatus,
      confidence: gatewayResult.confidence,
      failureReason: qualityDecision.status === "success" ? null : primaryReason,
      reviewRequiredReason: qualityDecision.status === "review_required" ? primaryReason : null,
      startedAt,
      endedAt,
      dataQualityFlags: qualityDecision.dataQualityFlags,
      reason: qualityDecision.status === "success" ? "ai_execution_completed" : "ai_execution_guarded",
      createdAt: gatewayResult.createdAt,
    });
  } catch (error) {
    return buildAiRuntimeFailureResult({
      request: input.request,
      promptContract: input.promptContract,
      childCapabilityId: input.childCapabilityId,
      startedAt,
      error,
    });
  }
}