import {
  AI_ABILITY_GROUP_ID,
  type AiCapabilityContext,
  type AiChildCapability,
  type AiExecutionOptions,
} from "../../contract.js";

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
    async execute(request, _context: AiCapabilityContext, _options?: AiExecutionOptions) {
      throw new Error(`paid-vision-ai is disabled by policy and cannot execute ${request.taskType}.`);
    },
  };
}