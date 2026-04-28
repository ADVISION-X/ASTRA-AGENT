import {
  AI_ABILITY_GROUP_ID,
  type AiCapabilityContext,
  type AiChildCapability,
  type AiExecutionOptions,
} from "../../contract.js";

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
    async execute(request, context: AiCapabilityContext, options?: AiExecutionOptions) {
      if (!this.canHandle(request.taskType)) {
        throw new Error(`paid-analysis-ai cannot execute ${request.taskType}.`);
      }

      return context.runtime.execute(request, options);
    },
  };
}