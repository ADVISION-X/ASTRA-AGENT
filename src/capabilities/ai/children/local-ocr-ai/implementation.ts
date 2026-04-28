import {
  AI_ABILITY_GROUP_ID,
  type AiCapabilityContext,
  type AiChildCapability,
  type AiExecutionOptions,
} from "../../contract.js";

const SUPPORTED_TASK_TYPES = ["ocr_cleanup"] as const;
const SUPPORTED_TASK_TYPE_SET = new Set<string>(SUPPORTED_TASK_TYPES);

export function createLocalOcrAiCapability(): AiChildCapability {
  return {
    abilityGroupId: AI_ABILITY_GROUP_ID,
    childCapabilityId: "local-ocr-ai",
    providerKind: "local",
    purpose: "Run local governed OCR cleanup for comment evidence.",
    supportedTaskTypes: SUPPORTED_TASK_TYPES,
    canHandle(taskType) {
      return SUPPORTED_TASK_TYPE_SET.has(taskType);
    },
    async checkReadiness(context: AiCapabilityContext) {
      const healthReport = await context.runtime.getHealth();
      return {
        abilityGroupId: AI_ABILITY_GROUP_ID,
        childCapabilityId: "local-ocr-ai",
        providerKind: "local",
        status: healthReport.health.dependencies.ocr === "ready" ? "ready" : "unavailable",
        supportedTaskTypes: [...SUPPORTED_TASK_TYPES],
        detail: `ocr=${healthReport.health.dependencies.ocr}`,
        enabledByPolicy: true,
      };
    },
    async execute(request, context: AiCapabilityContext, options?: AiExecutionOptions) {
      if (!this.canHandle(request.taskType)) {
        throw new Error(`local-ocr-ai cannot execute ${request.taskType}.`);
      }
      return context.runtime.execute(request, options);
    },
  };
}