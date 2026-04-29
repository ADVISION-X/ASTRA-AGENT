import { LocalAiGateway } from "../../../lib/local-ai/local-ai-gateway.js";
import { getPromptContract } from "../../../lib/local-ai/prompt-registry.js";
import {
  CommentSignalTaskRequestSchema,
  OcrTaskRequestSchema,
  ProductSignalTaskRequestSchema,
  VisionTaskRequestSchema,
} from "../../../types/local-ai.js";
import { VisionProductPresenceRequestInputSchema } from "../../../types/vision-product-presence.js";
import type { LocalAiHealth, LocalAiTaskRequest, LocalAiTaskResult, LocalAiTaskType } from "../../../types/local-ai.js";
import type { AiAbilityInput, AiPromptContract, AiRuntimeBridge, AiRuntimeHealth, AiTaskType } from "../contract.js";
import { loadAiModelRoster } from "../model-roster.js";
import {
  AiCommentSignalSummaryInputSchema,
  AiOcrCleanupInputSchema,
  AiProductSignalSummaryInputSchema,
  validateAiRuntimeHealth,
} from "../schema-validation.js";
import { routeAiTaskToChild } from "../task-router.js";
import { executeAiLocalRuntimeRequest } from "../runtime/ai-runtime-executor.js";

const LEGACY_TASK_BY_AI: Partial<Record<AiTaskType, LocalAiTaskType>> = {
  product_presence_judgment: "vision.productPresence",
  visual_observation: "vision.productPresence",
  visual_target_candidate_analysis: "vision.productPresence",
  ocr_cleanup: "comments.ocr_cleanup",
  comment_signal_summary: "comments.intent_analysis",
  product_signal_summary: "product.signal_summary",
};

const PRIMARY_AI_TASK_BY_LEGACY: Record<LocalAiTaskType, AiTaskType> = {
  "vision.productPresence": "product_presence_judgment",
  "comments.ocr_cleanup": "ocr_cleanup",
  "comments.intent_analysis": "comment_signal_summary",
  "product.signal_summary": "product_signal_summary",
};

function toAiPromptContract(taskType: AiTaskType): AiPromptContract {
  const legacyTaskType = LEGACY_TASK_BY_AI[taskType];
  if (legacyTaskType) {
    const contract = getPromptContract(legacyTaskType);
    return {
      taskType,
      modelRole: contract.modelRole === "commentUnderstanding" ? "commentUnderstanding" : contract.modelRole,
      promptId: contract.promptId,
      promptVersion: contract.promptVersion,
      schemaVersion: contract.schemaVersion,
      purpose: contract.purpose,
      forbiddenOutputs: [...contract.forbiddenOutputs],
    };
  }

  if (taskType === "evidence_packet_analysis") {
    return { taskType, modelRole: "future", promptId: "ai.evidence_packet_analysis.disabled", promptVersion: "evidence_packet_analysis.v1", schemaVersion: "ai.evidence_packet_analysis.v1", purpose: "Reserved paid analysis path for evidence-packet cognition.", forbiddenOutputs: ["implicit_paid_fallback"] };
  }

  return { taskType, modelRole: "schemaValidator", promptId: "ai.schema_validation_only.internal", promptVersion: "schema_validation_only.v1", schemaVersion: "ai.schema_validation_only.v1", purpose: "Validate a governed AI payload against the declared schema boundary.", forbiddenOutputs: ["schema_bypass"] };
}

function toAiRuntimeHealth(health: LocalAiHealth): AiRuntimeHealth {
  return validateAiRuntimeHealth({
    overallStatus: health.overallStatus,
    implementationStatus: health.implementationStatus,
    dependencies: {
      gateway: health.ollamaStatus,
      vision: health.visionModelStatus,
      text: health.textModelStatus,
      ocr: health.ocrStatus,
    },
    configuredModels: health.configuredModels,
    availableModels: health.availableModels,
    lastCheckedAt: health.lastCheckedAt,
    failureReason: health.failureReason,
    lastTaskType: health.lastTaskType ? PRIMARY_AI_TASK_BY_LEGACY[health.lastTaskType] : null,
    lastFailureReason: health.lastFailureReason,
    lastInvocationStatus: health.lastInvocationStatus,
  });
}

function toLocalAiTaskRequest(input: AiAbilityInput): LocalAiTaskRequest {
  const legacyTaskType = LEGACY_TASK_BY_AI[input.taskType];
  if (!legacyTaskType) {
    throw new Error(`Local AI runtime adapter cannot execute ${input.taskType}.`);
  }

  const id = `${input.sessionId}:${input.taskType}:${input.roundId ?? "no-round"}`;
  switch (legacyTaskType) {
    case "vision.productPresence":
      return VisionTaskRequestSchema.parse({
        id,
        taskType: "vision.productPresence",
        modelRole: "vision",
        promptVersion: "v1",
        schemaVersion: "vision.productPresence.schema.v1",
        evidenceRefs: input.inputRefs,
        input: VisionProductPresenceRequestInputSchema.parse(input.input),
      });
    case "comments.ocr_cleanup":
      return OcrTaskRequestSchema.parse({
        id,
        taskType: "comments.ocr_cleanup",
        modelRole: "ocr",
        promptVersion: "comments.ocr_cleanup.v1",
        schemaVersion: "ocr-text.v1",
        evidenceRefs: input.inputRefs,
        input: AiOcrCleanupInputSchema.parse(input.input),
      });
    case "comments.intent_analysis":
      return CommentSignalTaskRequestSchema.parse({
        id,
        taskType: "comments.intent_analysis",
        modelRole: "commentUnderstanding",
        promptVersion: "comments.intent_analysis.v1",
        schemaVersion: "comment-signal.v1",
        evidenceRefs: input.inputRefs,
        input: AiCommentSignalSummaryInputSchema.parse(input.input),
      });
    case "product.signal_summary": {
      const productSignalInput = AiProductSignalSummaryInputSchema.parse(input.input);
      return ProductSignalTaskRequestSchema.parse({
        id,
        taskType: "product.signal_summary",
        modelRole: "productSignal",
        promptVersion: "product.signal_summary.v1",
        schemaVersion: "product-opportunity-candidate.v1",
        evidenceRefs: input.inputRefs,
        input: {
          videoSummary: productSignalInput.videoSummary,
          productPresence: {
            taskType: "vision.productPresence",
            promptId: "vision.productPresence.v1",
            promptVersion: "v1",
            schemaVersion: "vision.productPresence.schema.v1",
            ...productSignalInput.productPresence,
          },
          commentSignals: productSignalInput.commentSignals,
        },
      });
    }
  }
}

export function createDefaultAiRuntimeBridge(): AiRuntimeBridge {
  const gateway = new LocalAiGateway();

  return {
    async execute(input, options) {
      const promptContract = toAiPromptContract(input.taskType);
      const childCapabilityId = routeAiTaskToChild(input.taskType);
      return executeAiLocalRuntimeRequest({
        request: input,
        childCapabilityId,
        promptContract,
        ...(options ? { options } : {}),
        executeGateway: async (executionOptions) => {
          const legacyRequest = toLocalAiTaskRequest(input);
          const result = await gateway.execute(legacyRequest, executionOptions?.debugHook ? { debugHook: executionOptions.debugHook } : {});
          return {
            taskType: result.taskType,
            runtime: result.runtime,
            model: result.model,
            implementationStatus: result.implementationStatus,
            confidence: result.confidence,
            createdAt: result.createdAt,
            result: result.result,
          };
        },
      });
    },
    async getHealth() {
      const report = await gateway.getHealth();
      return { ok: report.ok, detail: report.detail, health: toAiRuntimeHealth(report.health) };
    },
    async getRuntimeHealth() {
      return toAiRuntimeHealth(await gateway.getRuntimeHealth());
    },
    resolvePromptContract(taskType) {
      return toAiPromptContract(taskType);
    },
    getModelRoster() {
      return loadAiModelRoster();
    },
  };
}
