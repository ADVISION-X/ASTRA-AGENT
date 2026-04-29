import {
  AI_ABILITY_GROUP_ID,
  type AiCapabilityContext,
  type AiChildCapability,
  type AiExecutionOptions,
} from "../../contract.js";
import { buildAiPolicyFailureResult } from "../../runtime/ai-runtime-failure-result.js";
import { collectAiRuntimePolicyViolations } from "../../runtime/ai-runtime-policy-gate.js";

export function createFutureApiAiCapability(): AiChildCapability {
  return {
    abilityGroupId: AI_ABILITY_GROUP_ID,
    childCapabilityId: "future-api-ai",
    providerKind: "future",
    purpose: "Reserved future API slot for explicit operator-approved AI expansion.",
    supportedTaskTypes: [],
    canHandle() {
      return false;
    },
    async checkReadiness(_context: AiCapabilityContext) {
      return {
        abilityGroupId: AI_ABILITY_GROUP_ID,
        childCapabilityId: "future-api-ai",
        providerKind: "future",
        status: "disabled_by_policy",
        supportedTaskTypes: [],
        detail: "future-api-ai is a governed placeholder and cannot run until explicit law, policy, and operator approval exist.",
        enabledByPolicy: false,
      };
    },
    async execute(request, context: AiCapabilityContext, _options?: AiExecutionOptions) {
      const startedAt = new Date().toISOString();
      const promptContract = context.runtime.resolvePromptContract(request.taskType);
      return buildAiPolicyFailureResult({
        request,
        promptContract,
        childCapabilityId: "future-api-ai",
        startedAt,
        reasons: collectAiRuntimePolicyViolations({
          request,
          childCapabilityId: "future-api-ai",
          promptContract,
        }),
      });
    },
  };
}