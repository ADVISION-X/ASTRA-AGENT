import {
  AI_ABILITY_GROUP_ID,
  type AiCapabilityContext,
  type AiChildCapability,
  type AiChildCapabilityCheckResult,
  type AiExecutionOptions,
} from "../../contract.js";

const SUPPORTED_TASK_TYPES = ["product_presence_judgment", "visual_observation", "visual_target_candidate_analysis"] as const;
const SUPPORTED_TASK_TYPE_SET = new Set<string>(SUPPORTED_TASK_TYPES);

function buildStatus(detail: string, ready: boolean): AiChildCapabilityCheckResult {
  return {
    abilityGroupId: AI_ABILITY_GROUP_ID,
    childCapabilityId: "local-vision-ai",
    providerKind: "local",
    status: ready ? "ready" : "unavailable",
    supportedTaskTypes: [...SUPPORTED_TASK_TYPES],
    detail,
    enabledByPolicy: true,
  };
}

export function createLocalVisionAiCapability(): AiChildCapability {
  return {
    abilityGroupId: AI_ABILITY_GROUP_ID,
    childCapabilityId: "local-vision-ai",
    providerKind: "local",
    purpose: "Run local governed vision reasoning for product-presence judgment.",
    supportedTaskTypes: SUPPORTED_TASK_TYPES,
    canHandle(taskType) {
      return SUPPORTED_TASK_TYPE_SET.has(taskType);
    },
    async checkReadiness(context: AiCapabilityContext) {
      const healthReport = await context.runtime.getHealth();
      return buildStatus(`vision=${healthReport.health.dependencies.vision}`, healthReport.health.dependencies.vision === "ready");
    },
    async execute(request, context: AiCapabilityContext, options?: AiExecutionOptions) {
      if (!this.canHandle(request.taskType)) {
        throw new Error(`local-vision-ai cannot execute ${request.taskType}.`);
      }
      return context.runtime.execute(request, options);
    },
  };
}