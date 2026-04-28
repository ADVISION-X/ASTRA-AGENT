import {
  AI_ABILITY_GROUP_ID,
  type AiCapabilityContext,
  type AiChildCapability,
  type AiExecutionOptions,
} from "../../contract.js";

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
    async execute(request, _context: AiCapabilityContext, _options?: AiExecutionOptions) {
      throw new Error(`future-api-ai is disabled by policy and cannot execute ${request.taskType}.`);
    },
  };
}