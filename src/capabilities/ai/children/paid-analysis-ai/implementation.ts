import {
  AI_ABILITY_GROUP_ID,
  type AiCapabilityContext,
  type AiChildCapability,
  type AiExecutionOptions,
} from "../../contract.js";
import { buildAiDispatchFailureResult, buildAiPolicyFailureResult } from "../../runtime/ai-runtime-failure-result.js";
import { collectAiRuntimePolicyViolations } from "../../runtime/ai-runtime-policy-gate.js";

export function createPaidAnalysisAiCapability(): AiChildCapability {
  return {
    abilityGroupId: AI_ABILITY_GROUP_ID,
    childCapabilityId: "paid-analysis-ai",
    providerKind: "paid",
    purpose: "Reserved paid analysis provider slot that remains disabled by policy.",
    supportedTaskTypes: ["evidence_packet_analysis"],
    canHandle(taskType) {
      return taskType === "evidence_packet_analysis";
    },
    async checkReadiness(_context: AiCapabilityContext) {
      return {
        abilityGroupId: AI_ABILITY_GROUP_ID,
        childCapabilityId: "paid-analysis-ai",
        providerKind: "paid",
        status: "disabled_by_policy",
        supportedTaskTypes: ["evidence_packet_analysis"],
        detail: "Paid analysis AI is declared but disabled_by_policy until explicit provider allowlist, data policy, cost cap, and operator approval exist.",
        enabledByPolicy: false,
      };
    },
    async execute(request, context: AiCapabilityContext, _options?: AiExecutionOptions) {
      if (!this.canHandle(request.taskType)) {
        return buildAiDispatchFailureResult({
          request,
          promptContract: context.runtime.resolvePromptContract(request.taskType),
          childCapabilityId: "paid-analysis-ai",
          startedAt: new Date().toISOString(),
          failureReason: `paid-analysis-ai cannot execute ${request.taskType}.`,
          implementationStatus: "task_type_mismatch",
        });
      }

      const startedAt = new Date().toISOString();
      const promptContract = context.runtime.resolvePromptContract(request.taskType);
      return buildAiPolicyFailureResult({
        request,
        promptContract,
        childCapabilityId: "paid-analysis-ai",
        startedAt,
        reasons: collectAiRuntimePolicyViolations({
          request,
          childCapabilityId: "paid-analysis-ai",
          promptContract,
        }),
      });
    },
  };
}