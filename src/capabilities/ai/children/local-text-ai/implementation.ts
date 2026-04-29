import {
  AI_ABILITY_GROUP_ID,
  type AiCapabilityContext,
  type AiChildCapability,
  type AiExecutionOptions,
} from "../../contract.js";
import { buildAiDispatchFailureResult } from "../../runtime/ai-runtime-failure-result.js";

const SUPPORTED_TASK_TYPES = ["comment_signal_summary", "product_signal_summary"] as const;
const SUPPORTED_TASK_TYPE_SET = new Set<string>(SUPPORTED_TASK_TYPES);

export function createLocalTextAiCapability(): AiChildCapability {
  return {
    abilityGroupId: AI_ABILITY_GROUP_ID,
    childCapabilityId: "local-text-ai",
    providerKind: "local",
    purpose: "Run local governed text reasoning for comment understanding and product-signal synthesis.",
    supportedTaskTypes: SUPPORTED_TASK_TYPES,
    canHandle(taskType) {
      return SUPPORTED_TASK_TYPE_SET.has(taskType);
    },
    async checkReadiness(context: AiCapabilityContext) {
      const [healthReport, modelRoster] = await Promise.all([context.runtime.getHealth(), context.runtime.getModelRoster()]);
      const rosterEntry = modelRoster.entries.find((entry) => entry.childCapabilityId === "local-text-ai");
      return {
        abilityGroupId: AI_ABILITY_GROUP_ID,
        childCapabilityId: "local-text-ai",
        providerKind: "local",
        status: healthReport.health.dependencies.text === "ready" ? "ready" : "unavailable",
        supportedTaskTypes: [...SUPPORTED_TASK_TYPES],
        detail: `text=${healthReport.health.dependencies.text}; models=${rosterEntry?.modelOrTool ?? "unknown"}`,
        enabledByPolicy: true,
      };
    },
    async execute(request, context: AiCapabilityContext, options?: AiExecutionOptions) {
      if (!this.canHandle(request.taskType)) {
        return buildAiDispatchFailureResult({
          request,
          promptContract: context.runtime.resolvePromptContract(request.taskType),
          childCapabilityId: "local-text-ai",
          startedAt: new Date().toISOString(),
          failureReason: `local-text-ai cannot execute ${request.taskType}.`,
          implementationStatus: "task_type_mismatch",
        });
      }
      return context.runtime.execute(request, options);
    },
  };
}