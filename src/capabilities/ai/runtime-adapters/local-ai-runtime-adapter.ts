import { LocalAiGateway } from "../../../lib/local-ai/local-ai-gateway.js";
import {
  CommentSignalTaskRequestSchema,
  OcrTaskRequestSchema,
  ProductSignalTaskRequestSchema,
  VisionTaskRequestSchema,
  type LocalAiHealth,
  type LocalAiTaskRequest,
  type LocalAiTaskType,
} from "../../../types/local-ai.js";
import { VisionProductPresenceRequestInputSchema } from "../../../types/vision-product-presence.js";
import type {
  AiAbilityInput,
  AiRuntimeExecutionOutput,
  AiRuntimeHealth,
  AiTaskType,
} from "../contract.js";
import type { AiRuntimePort } from "../ports/ai-runtime-port.js";
import { AiRuntimeExecutionOutputSchema, AiRuntimeHealthSchema } from "../schema.js";
import { parseExtractedJson } from "../shared/ai-json-extract.js";

const AI_TASK_BY_LEGACY: Record<LocalAiTaskType, AiTaskType> = {
  "vision.productPresence": "product_presence_judgment",
  "comments.ocr_cleanup": "ocr_cleanup",
  "comments.intent_analysis": "comment_signal_summary",
  "product.signal_summary": "product_signal_summary",
};

function toAiRuntimeHealth(health: LocalAiHealth): AiRuntimeHealth {
  return AiRuntimeHealthSchema.parse({
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
    lastTaskType: health.lastTaskType ? AI_TASK_BY_LEGACY[health.lastTaskType] : null,
    lastFailureReason: health.lastFailureReason,
    lastInvocationStatus: health.lastInvocationStatus,
  });
}

function coerceRuntimeOutput(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const parsed = parseExtractedJson(value);
  return parsed.ok ? parsed.value : value;
}

function toLocalAiTaskRequest(input: AiAbilityInput): { ok: true; request: LocalAiTaskRequest } | { ok: false; message: string } {
  switch (input.taskType) {
    case "product_presence_judgment":
    case "visual_observation":
    case "visual_target_candidate_analysis":
      return {
        ok: true,
        request: VisionTaskRequestSchema.parse({
          id: `${input.sessionId}:${input.taskType}:${input.roundId ?? "no-round"}`,
          taskType: "vision.productPresence",
          modelRole: "vision",
          promptVersion: "v1",
          schemaVersion: "vision.productPresence.schema.v1",
          evidenceRefs: input.inputRefs,
          input: VisionProductPresenceRequestInputSchema.parse(input.input),
        }),
      };
    case "ocr_cleanup":
      return {
        ok: true,
        request: OcrTaskRequestSchema.parse({
          id: `${input.sessionId}:${input.taskType}:${input.roundId ?? "no-round"}`,
          taskType: "comments.ocr_cleanup",
          modelRole: "ocr",
          promptVersion: "comments.ocr_cleanup.v1",
          schemaVersion: "ocr-text.v1",
          evidenceRefs: input.inputRefs,
          input: input.input,
        }),
      };
    case "comment_signal_summary":
      return {
        ok: true,
        request: CommentSignalTaskRequestSchema.parse({
          id: `${input.sessionId}:${input.taskType}:${input.roundId ?? "no-round"}`,
          taskType: "comments.intent_analysis",
          modelRole: "commentUnderstanding",
          promptVersion: "comments.intent_analysis.v1",
          schemaVersion: "comment-signal.v1",
          evidenceRefs: input.inputRefs,
          input: input.input,
        }),
      };
    case "product_signal_summary":
      {
        const typedInput = input.input;
        return {
          ok: true,
          request: ProductSignalTaskRequestSchema.parse({
            id: `${input.sessionId}:${input.taskType}:${input.roundId ?? "no-round"}`,
            taskType: "product.signal_summary",
            modelRole: "productSignal",
            promptVersion: "product.signal_summary.v1",
            schemaVersion: "product-opportunity-candidate.v1",
            evidenceRefs: input.inputRefs,
            input: {
              videoSummary: typedInput.videoSummary,
              productPresence: {
                taskType: "vision.productPresence",
                promptId: "vision.productPresence.v1",
                promptVersion: "v1",
                schemaVersion: "vision.productPresence.schema.v1",
                ...typedInput.productPresence,
              },
              commentSignals: typedInput.commentSignals,
            },
          }),
        };
      }
    case "evidence_packet_analysis":
    case "schema_validation_only":
      return {
        ok: false,
        message: `Local AI runtime adapter is not authorized to execute ${input.taskType}.`,
      };
  }
}

export function createLocalAiRuntimePort(): AiRuntimePort {
  const gateway = new LocalAiGateway();

  return {
    async execute(request): Promise<AiRuntimeExecutionOutput> {
      const converted = toLocalAiTaskRequest(request);
      if (converted.ok === false) {
        return AiRuntimeExecutionOutputSchema.parse({
          modelProvider: "local",
          modelName: "unavailable",
          modelRole: request.taskType === "ocr_cleanup" ? "ocr" : request.taskType === "comment_signal_summary" || request.taskType === "product_signal_summary" ? "multi-role" : "vision",
          runtime: "local-adapter",
          implementationStatus: "task_type_mismatch",
          createdAt: null,
          confidence: null,
          costEstimate: 0,
          output: { message: converted.message },
          rawOutputRef: null,
        });
      }

      try {
        const result = await gateway.execute(converted.request);
        return AiRuntimeExecutionOutputSchema.parse({
          modelProvider: "local",
          modelName: result.model,
          modelRole: result.modelRole,
          runtime: result.runtime,
          implementationStatus: result.implementationStatus,
          createdAt: result.createdAt,
          confidence: result.confidence,
          costEstimate: 0,
          output: coerceRuntimeOutput(result.result),
          rawOutputRef: null,
        });
      } catch (error) {
        return AiRuntimeExecutionOutputSchema.parse({
          modelProvider: "local",
          modelName: "unavailable",
          modelRole: request.taskType === "ocr_cleanup" ? "ocr" : request.taskType === "comment_signal_summary" || request.taskType === "product_signal_summary" ? "multi-role" : "vision",
          runtime: "local-adapter",
          implementationStatus: "runtime_threw",
          createdAt: null,
          confidence: null,
          costEstimate: 0,
          output: {
            message: error instanceof Error ? error.message : "Local AI runtime failed.",
          },
          rawOutputRef: null,
        });
      }
    },
    async getHealth() {
      const report = await gateway.getHealth();
      return {
        ok: report.ok,
        detail: report.detail,
        health: toAiRuntimeHealth(report.health),
      };
    },
    async getRuntimeHealth() {
      return toAiRuntimeHealth(await gateway.getRuntimeHealth());
    },
  };
}
