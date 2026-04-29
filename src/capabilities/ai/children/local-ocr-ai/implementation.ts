import {
  AI_ABILITY_GROUP_ID,
  type AiCapabilityContext,
  type AiChildCapability,
  type AiExecutionOptions,
} from "../../contract.js";
import { buildAiDispatchFailureResult } from "../../runtime/ai-runtime-failure-result.js";

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
        return buildAiDispatchFailureResult({
          request,
          promptContract: context.runtime.resolvePromptContract(request.taskType),
          childCapabilityId: "local-ocr-ai",
          startedAt: new Date().toISOString(),
          failureReason: `local-ocr-ai cannot execute ${request.taskType}.`,
          implementationStatus: "task_type_mismatch",
        });
      }
      return context.runtime.execute(request, options);
    },
  };
}