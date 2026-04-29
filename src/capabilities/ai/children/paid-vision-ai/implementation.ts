import {
  AI_ABILITY_GROUP_ID,
  type AiCapabilityContext,
  type AiChildCapability,
  type AiExecutionOptions,
} from "../../contract.js";
import { buildAiPolicyFailureResult } from "../../runtime/ai-runtime-failure-result.js";
import { collectAiRuntimePolicyViolations } from "../../runtime/ai-runtime-policy-gate.js";

export function createPaidVisionAiCapability(): AiChildCapability {
  return {
    abilityGroupId: AI_ABILITY_GROUP_ID,
    childCapabilityId: "paid-vision-ai",
    providerKind: "paid",
    purpose: "Reserved paid vision provider slot that remains disabled by policy.",
    supportedTaskTypes: ["visual_observation", "visual_target_candidate_analysis"],
    canHandle() {
      return false;
    },
    async checkReadiness(_context: AiCapabilityContext) {
      return {
        abilityGroupId: AI_ABILITY_GROUP_ID,
        childCapabilityId: "paid-vision-ai",
        providerKind: "paid",
        status: "disabled_by_policy",
        supportedTaskTypes: ["visual_observation", "visual_target_candidate_analysis"],
        detail: "Paid vision AI is declared but disabled_by_policy until explicit provider allowlist, data policy, cost cap, and operator approval exist.",
        enabledByPolicy: false,
      };
    },
    async execute(request, context: AiCapabilityContext, _options?: AiExecutionOptions) {
      const startedAt = new Date().toISOString();
      const promptContract = context.runtime.resolvePromptContract(request.taskType);
      return buildAiPolicyFailureResult({
        request,
        promptContract,
        childCapabilityId: "paid-vision-ai",
        startedAt,
        reasons: collectAiRuntimePolicyViolations({
          request,
          childCapabilityId: "paid-vision-ai",
          promptContract,
        }),
      });
    },
  };
}