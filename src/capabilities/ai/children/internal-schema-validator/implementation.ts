import {
  AI_ABILITY_GROUP_ID,
  type AiCapabilityContext,
  type AiChildCapability,
  type AiExecutionOptions,
} from "../../contract.js";
import { buildAiDispatchFailureResult } from "../../runtime/ai-runtime-failure-result.js";
import { executeAiSchemaValidationOnly } from "../../runtime/ai-runtime-schema-gate.js";

const SUPPORTED_TASK_TYPES = ["schema_validation_only"] as const;

export function createInternalSchemaValidatorCapability(): AiChildCapability {
  return {
    abilityGroupId: AI_ABILITY_GROUP_ID,
    childCapabilityId: "internal-schema-validator",
    providerKind: "internal",
    purpose: "Run governed internal schema validation without entering LocalAiGateway.",
    supportedTaskTypes: SUPPORTED_TASK_TYPES,
    canHandle(taskType) {
      return taskType === "schema_validation_only";
    },
    async checkReadiness(_context: AiCapabilityContext) {
      return {
        abilityGroupId: AI_ABILITY_GROUP_ID,
        childCapabilityId: "internal-schema-validator",
        providerKind: "internal",
        status: "ready",
        supportedTaskTypes: [...SUPPORTED_TASK_TYPES],
        detail: "internal-schema-validator executes schema_validation_only without LocalAiGateway.",
        enabledByPolicy: true,
      };
    },
    async execute(request, context: AiCapabilityContext, _options?: AiExecutionOptions) {
      if (!this.canHandle(request.taskType)) {
        return buildAiDispatchFailureResult({
          request,
          promptContract: context.runtime.resolvePromptContract(request.taskType),
          childCapabilityId: "internal-schema-validator",
          startedAt: new Date().toISOString(),
          failureReason: `internal-schema-validator cannot execute ${request.taskType}.`,
          implementationStatus: "task_type_mismatch",
        });
      }

      return executeAiSchemaValidationOnly({
        request,
        promptContract: context.runtime.resolvePromptContract(request.taskType),
        childCapabilityId: "internal-schema-validator",
        startedAt: new Date().toISOString(),
      });
    },
  };
}