import {
  AiPagePreparationRequestInputSchema,
  AiCommentSignalSummaryInputSchema,
  AiOcrCleanupInputSchema,
  AiProductSignalSummaryInputSchema,
  AiRuntimeHealthSchema,
  AiVisionRequestInputSchema,
} from "../schema.js";
import {
  CommentSignalTaskRequestSchema,
  CommentsEntryTargetCandidateTaskRequestSchema,
  NextItemAdvancedTaskRequestSchema,
  NextItemTargetCandidateTaskRequestSchema,
  OcrTaskRequestSchema,
  PagePreparationTaskRequestSchema,
  ProductSignalTaskRequestSchema,
  VisionTaskRequestSchema,
  type LocalAiHealth,
  type LocalAiTaskRequest,
  type LocalAiTaskType,
} from "../../../types/local-ai.js";
import { VisionPagePreparationRequestInputSchema } from "../../../types/vision-page-preparation.js";
import { VisionNextItemAdvancedRequestInputSchema } from "../../../types/vision-next-item-advanced.js";
import { VisionCommentsEntryTargetCandidateRequestInputSchema } from "../../../types/vision-comments-entry-target-candidate.js";
import { VisionNextItemTargetCandidateRequestInputSchema } from "../../../types/vision-next-item-target-candidate.js";
import { VisionProductPresenceRequestInputSchema } from "../../../types/vision-product-presence.js";
import { resolvePromptContractCatalogEntryByLocalTaskType } from "../prompt-contracts/local-ai-task-contracts.js";
import type { PromptContractCatalogEntry } from "../prompt-contracts/schema.js";
import type { AiRuntimeHealth, AiTaskType, ParsedAiAbilityInput } from "../contract.js";
import { parseExtractedJson } from "../shared/ai-json-extract.js";
const AI_TASK_BY_LEGACY: Record<LocalAiTaskType, AiTaskType> = {
  "vision.pagePreparation": "page_preparation_judgment",
  "vision.nextItemAdvanced": "page_preparation_judgment",
  "vision.productPresence": "product_presence_judgment",
  "vision.nextItemTargetCandidate": "visual_target_candidate_analysis",
  "vision.commentsEntryTargetCandidate": "visual_target_candidate_analysis",
  "comments.ocr_cleanup": "ocr_cleanup",
  "comments.intent_analysis": "comment_signal_summary",
  "product.signal_summary": "product_signal_summary",
};
type PagePreparationBridgeInput = Extract<ParsedAiAbilityInput, { taskType: "page_preparation_judgment" }>;
type VisionBridgeInput = Extract<ParsedAiAbilityInput, { taskType: "product_presence_judgment" | "visual_observation" }>;
type VisualTargetCandidateBridgeInput = Extract<ParsedAiAbilityInput, { taskType: "visual_target_candidate_analysis" }>;
type OcrBridgeInput = Extract<ParsedAiAbilityInput, { taskType: "ocr_cleanup" }>;
type CommentSignalBridgeInput = Extract<ParsedAiAbilityInput, { taskType: "comment_signal_summary" }>;
type ProductSignalBridgeInput = Extract<ParsedAiAbilityInput, { taskType: "product_signal_summary" }>;

type LocalAiTaskRequestResolution =
  | { ok: true; request: LocalAiTaskRequest }
  | {
      ok: false;
      implementationStatus: "prompt_contract_rejected" | "task_type_mismatch";
      failureReason: "legacy_task_mapping_missing" | "prompt_catalog_integrity_failed" | "task_type_mismatch";
      message: string;
    };
function rejectLocalAiTaskRequest(input: LocalAiTaskRequestResolution & { ok: false }): LocalAiTaskRequestResolution { return input; }
function resolveLegacyPromptContract(taskType: LocalAiTaskType) {
  return resolvePromptContractCatalogEntryByLocalTaskType(taskType);
}
function buildVisionTaskRequest(input: VisionBridgeInput, promptContract: PromptContractCatalogEntry): LocalAiTaskRequest {
  return VisionTaskRequestSchema.parse({
    id: `${input.sessionId}:${input.taskType}:${input.roundId ?? "no-round"}`,
    taskType: "vision.productPresence",
    modelRole: promptContract.modelRole,
    promptVersion: promptContract.promptVersion,
    schemaVersion: promptContract.schemaVersion,
    evidenceRefs: input.inputRefs,
    input: VisionProductPresenceRequestInputSchema.parse(AiVisionRequestInputSchema.parse(input.input)),
  });
}
function buildVisualTargetCandidateTaskRequest(
  input: VisualTargetCandidateBridgeInput,
  promptContract: PromptContractCatalogEntry,
): LocalAiTaskRequest {
  const typedInput = AiVisionRequestInputSchema.parse(input.input);
  const requestBase = {
    id: `${input.sessionId}:${input.taskType}:${input.roundId ?? "no-round"}`,
    modelRole: promptContract.modelRole,
    promptVersion: promptContract.promptVersion,
    schemaVersion: promptContract.schemaVersion,
    evidenceRefs: input.inputRefs,
  };
  return promptContract.legacyTaskType === "vision.commentsEntryTargetCandidate"
    ? CommentsEntryTargetCandidateTaskRequestSchema.parse({
      ...requestBase,
      taskType: "vision.commentsEntryTargetCandidate",
      input: VisionCommentsEntryTargetCandidateRequestInputSchema.parse(typedInput),
    })
    : NextItemTargetCandidateTaskRequestSchema.parse({
      ...requestBase,
      taskType: "vision.nextItemTargetCandidate",
      input: VisionNextItemTargetCandidateRequestInputSchema.parse(typedInput),
    });
}
function buildPagePreparationTaskRequest(
  input: PagePreparationBridgeInput,
  promptContract: PromptContractCatalogEntry,
): LocalAiTaskRequest {
  const typedInput = AiPagePreparationRequestInputSchema.parse(input.input);
  const requestBase = {
    id: `${input.sessionId}:${input.taskType}:${input.roundId ?? "no-round"}`,
    modelRole: promptContract.modelRole,
    promptVersion: promptContract.promptVersion,
    schemaVersion: promptContract.schemaVersion,
    evidenceRefs: input.inputRefs,
  };
  return promptContract.legacyTaskType === "vision.nextItemAdvanced"
    ? NextItemAdvancedTaskRequestSchema.parse({
      ...requestBase,
      taskType: "vision.nextItemAdvanced",
      input: VisionNextItemAdvancedRequestInputSchema.parse(typedInput),
    })
    : PagePreparationTaskRequestSchema.parse({
      ...requestBase,
      taskType: "vision.pagePreparation",
      input: VisionPagePreparationRequestInputSchema.parse(typedInput),
    });
}
function buildOcrTaskRequest(input: OcrBridgeInput, promptContract: PromptContractCatalogEntry): LocalAiTaskRequest {
  return OcrTaskRequestSchema.parse({
    id: `${input.sessionId}:${input.taskType}:${input.roundId ?? "no-round"}`,
    taskType: "comments.ocr_cleanup",
    modelRole: promptContract.modelRole,
    promptVersion: promptContract.promptVersion,
    schemaVersion: promptContract.schemaVersion,
    evidenceRefs: input.inputRefs,
    input: AiOcrCleanupInputSchema.parse(input.input),
  });
}
function buildCommentSignalTaskRequest(
  input: CommentSignalBridgeInput,
  promptContract: PromptContractCatalogEntry,
): LocalAiTaskRequest {
  return CommentSignalTaskRequestSchema.parse({
    id: `${input.sessionId}:${input.taskType}:${input.roundId ?? "no-round"}`,
    taskType: "comments.intent_analysis",
    modelRole: promptContract.modelRole,
    promptVersion: promptContract.promptVersion,
    schemaVersion: promptContract.schemaVersion,
    evidenceRefs: input.inputRefs,
    input: AiCommentSignalSummaryInputSchema.parse(input.input),
  });
}
function buildProductSignalTaskRequest(
  input: ProductSignalBridgeInput,
  promptContract: PromptContractCatalogEntry,
  productPresencePromptContract: PromptContractCatalogEntry,
): LocalAiTaskRequest {
  const typedInput = AiProductSignalSummaryInputSchema.parse(input.input);
  return ProductSignalTaskRequestSchema.parse({
    id: `${input.sessionId}:${input.taskType}:${input.roundId ?? "no-round"}`,
    taskType: "product.signal_summary",
    modelRole: promptContract.modelRole,
    promptVersion: promptContract.promptVersion,
    schemaVersion: promptContract.schemaVersion,
    evidenceRefs: input.inputRefs,
    input: {
      videoSummary: typedInput.videoSummary,
      productPresence: {
        taskType: "vision.productPresence",
        promptId: productPresencePromptContract.promptId,
        promptVersion: productPresencePromptContract.promptVersion,
        schemaVersion: productPresencePromptContract.schemaVersion,
        ...typedInput.productPresence,
      },
      commentSignals: typedInput.commentSignals,
    },
  });
}
function describeHealth(health: AiRuntimeHealth): string {
  return JSON.stringify({
    overallStatus: health.overallStatus,
    implementationStatus: health.implementationStatus,
    dependencies: health.dependencies,
    lastInvocationStatus: health.lastInvocationStatus,
  });
}
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
function resolveLocalAiPromptRequest(
  taskType: LocalAiTaskType,
  buildRequest: (promptContract: PromptContractCatalogEntry) => LocalAiTaskRequest,
): LocalAiTaskRequestResolution {
  const promptContract = resolveLegacyPromptContract(taskType);
  if (!promptContract.ok) {
    return rejectLocalAiTaskRequest({
      ok: false,
      implementationStatus: "prompt_contract_rejected",
      failureReason: promptContract.failureReason,
      message: promptContract.message,
    });
  }
  return { ok: true, request: buildRequest(promptContract.contract) };
}
function toVisionTaskRequest(input: VisionBridgeInput): LocalAiTaskRequestResolution {
  return resolveLocalAiPromptRequest("vision.productPresence", (promptContract) => buildVisionTaskRequest(input, promptContract));
}
function toVisualTargetCandidateTaskRequest(input: VisualTargetCandidateBridgeInput): LocalAiTaskRequestResolution {
  const localTaskType = input.promptContractId === "vision.commentsEntryTargetCandidate.v1"
    ? "vision.commentsEntryTargetCandidate"
    : "vision.nextItemTargetCandidate";
  return resolveLocalAiPromptRequest(localTaskType, (promptContract) => buildVisualTargetCandidateTaskRequest(input, promptContract));
}
function toPagePreparationTaskRequest(input: PagePreparationBridgeInput): LocalAiTaskRequestResolution {
  const localTaskType = input.promptContractId === "vision.nextItemAdvanced.v1"
    ? "vision.nextItemAdvanced"
    : "vision.pagePreparation";
  return resolveLocalAiPromptRequest(localTaskType, (promptContract) => buildPagePreparationTaskRequest(input, promptContract));
}
function toOcrTaskRequest(input: OcrBridgeInput): LocalAiTaskRequestResolution {
  return resolveLocalAiPromptRequest("comments.ocr_cleanup", (promptContract) => buildOcrTaskRequest(input, promptContract));
}
function toCommentSignalTaskRequest(input: CommentSignalBridgeInput): LocalAiTaskRequestResolution {
  return resolveLocalAiPromptRequest("comments.intent_analysis", (promptContract) => buildCommentSignalTaskRequest(input, promptContract));
}
function toProductSignalTaskRequest(input: ProductSignalBridgeInput): LocalAiTaskRequestResolution {
  const promptContract = resolveLegacyPromptContract("product.signal_summary");
  if (!promptContract.ok) {
    return rejectLocalAiTaskRequest({
      ok: false,
      implementationStatus: "prompt_contract_rejected",
      failureReason: promptContract.failureReason,
      message: promptContract.message,
    });
  }

  const productPresencePromptContract = resolveLegacyPromptContract("vision.productPresence");
  if (!productPresencePromptContract.ok) {
    return rejectLocalAiTaskRequest({
      ok: false,
      implementationStatus: "prompt_contract_rejected",
      failureReason: productPresencePromptContract.failureReason,
      message: productPresencePromptContract.message,
    });
  }
  return {
    ok: true,
    request: buildProductSignalTaskRequest(input, promptContract.contract, productPresencePromptContract.contract),
  };
}

function toLocalAiTaskRequest(input: ParsedAiAbilityInput): LocalAiTaskRequestResolution {
  switch (input.taskType) {
    case "page_preparation_judgment":
      return toPagePreparationTaskRequest(input);
    case "product_presence_judgment":
    case "visual_observation":
      return toVisionTaskRequest(input);
    case "visual_target_candidate_analysis":
      return toVisualTargetCandidateTaskRequest(input);
    case "ocr_cleanup":
      return toOcrTaskRequest(input);
    case "comment_signal_summary":
      return toCommentSignalTaskRequest(input);
    case "product_signal_summary":
      return toProductSignalTaskRequest(input);
  }

  return rejectLocalAiTaskRequest({
    ok: false,
    implementationStatus: "task_type_mismatch",
    failureReason: "task_type_mismatch",
    message: `Local AI runtime adapter is not authorized to execute ${input.taskType}.`,
  });
}

export {
  describeHealth,
  toAiRuntimeHealth,
  coerceRuntimeOutput,
  toLocalAiTaskRequest,
};