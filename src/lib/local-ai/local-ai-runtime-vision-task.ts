import {
  CommentsEntryTargetCandidateTaskResultSchema,
  NextItemTargetCandidateTaskResultSchema,
  VisionTaskResultSchema,
} from "../../types/local-ai.js";
import { parseCommentsEntryTargetCandidateRuntimeOutput } from "./local-ai-runtime-comments-entry-target-candidate.js";
import { buildCommentsEntryTargetCandidatePromptParts } from "./local-ai-runtime-comments-entry-target-candidate-prompt.js";
import { parseNextItemTargetCandidateRuntimeOutput } from "./local-ai-runtime-target-candidate.js";
import { buildNextItemTargetCandidatePromptParts } from "./local-ai-runtime-target-candidate-prompt.js";
import { parseVisionRuntimeOutput } from "./local-ai-runtime-vision.js";
import { buildVisionPromptParts } from "./local-ai-runtime-vision-prompt.js";
import {
  MODEL_TIMEOUT_MS,
  buildPromptPreview,
  hashText,
  isFullAiIoDebugEnabled,
  type RuntimeExecutionInput,
} from "./local-ai-runtime-task-support.js";

type VisionProductPresenceRequest = Extract<RuntimeExecutionInput["request"], { taskType: "vision.productPresence" }>;
type NextItemTargetCandidateRequest = Extract<RuntimeExecutionInput["request"], { taskType: "vision.nextItemTargetCandidate" }>;
type CommentsEntryTargetCandidateRequest = Extract<RuntimeExecutionInput["request"], { taskType: "vision.commentsEntryTargetCandidate" }>;
type SupportedVisionRequest = VisionProductPresenceRequest | NextItemTargetCandidateRequest | CommentsEntryTargetCandidateRequest;

function resolveVisionRequestArtifacts(request: SupportedVisionRequest) {
  const imagePaths = request.evidenceRefs.map((ref) => ref.filePath).filter((filePath): filePath is string => typeof filePath === "string" && filePath.length > 0);
  const promptParts = request.taskType === "vision.nextItemTargetCandidate"
    ? buildNextItemTargetCandidatePromptParts(request)
    : request.taskType === "vision.commentsEntryTargetCandidate"
      ? buildCommentsEntryTargetCandidatePromptParts(request)
    : buildVisionPromptParts(request);
  return {
    imagePaths,
    promptParts,
    prompt: promptParts.fullPrompt,
    promptFullText: isFullAiIoDebugEnabled() ? promptParts.fullPrompt : undefined,
    promptContractId: request.taskType === "vision.nextItemTargetCandidate"
      ? "vision.nextItemTargetCandidate.v1"
      : request.taskType === "vision.commentsEntryTargetCandidate"
        ? "vision.commentsEntryTargetCandidate.v1"
      : "vision.productPresence.v1",
    sourceScreenshotEvidenceId: typeof request.input.screenshotEvidenceId === "string" ? request.input.screenshotEvidenceId : undefined,
    aiInputArtifactRef: request.input.contactSheetEvidenceId ?? request.input.multiFrameEvidenceSetId ?? request.evidenceRefs[0]?.id,
  };
}

function buildVisionDebugStartPayload(input: RuntimeExecutionInput, artifacts: ReturnType<typeof resolveVisionRequestArtifacts>) {
  const request = input.request as SupportedVisionRequest;
  return {
    eventType: "local_ai_runtime_request_started" as const,
    detail: `taskType=${request.taskType}; model=${input.roleConfig.model}; timeoutMs=60000; promptLength=${artifacts.prompt.length}; imageCount=${artifacts.imagePaths.length}`,
    taskType: request.taskType,
    promptContractId: artifacts.promptContractId,
    promptVersion: request.promptVersion,
    outputSchemaRef: request.schemaVersion,
    modelName: input.roleConfig.model,
    modelRole: request.modelRole,
    runtime: input.roleConfig.runtime,
    systemPromptText: artifacts.promptParts.systemPrompt,
    userPromptText: artifacts.promptParts.userPrompt,
    systemPromptHash: hashText(artifacts.promptParts.systemPrompt),
    userPromptHash: hashText(artifacts.promptParts.userPrompt),
    promptPreview: buildPromptPreview(artifacts.promptParts.fullPrompt),
    ...(artifacts.promptFullText ? { promptFullText: artifacts.promptFullText } : {}),
    ...(artifacts.sourceScreenshotEvidenceId ? { sourceScreenshotEvidenceId: artifacts.sourceScreenshotEvidenceId } : {}),
    ...(artifacts.aiInputArtifactRef ? { aiInputArtifactRef: artifacts.aiInputArtifactRef } : {}),
    imageInputs: request.evidenceRefs.map((ref) => ({
      refId: ref.id,
      filePath: ref.filePath ?? "",
    })),
  };
}

function buildVisionTaskResult(input: RuntimeExecutionInput, createdAt: string, payload: unknown) {
  if (input.request.taskType === "vision.nextItemTargetCandidate") {
    return NextItemTargetCandidateTaskResultSchema.parse({
      id: input.request.id,
      taskType: input.request.taskType,
      modelRole: input.request.modelRole,
      provider: "local",
      runtime: input.roleConfig.runtime,
      model: input.roleConfig.model,
      implementationStatus: "model_backed",
      promptVersion: input.request.promptVersion,
      schemaVersion: input.request.schemaVersion,
      evidenceRefs: input.request.evidenceRefs,
      confidence: typeof payload === "object" && payload !== null && typeof (payload as { confidence?: unknown }).confidence === "number"
        ? (payload as { confidence: number }).confidence
        : 0,
      createdAt,
      result: payload,
    });
  }

  if (input.request.taskType === "vision.commentsEntryTargetCandidate") {
    return CommentsEntryTargetCandidateTaskResultSchema.parse({
      id: input.request.id,
      taskType: input.request.taskType,
      modelRole: input.request.modelRole,
      provider: "local",
      runtime: input.roleConfig.runtime,
      model: input.roleConfig.model,
      implementationStatus: "model_backed",
      promptVersion: input.request.promptVersion,
      schemaVersion: input.request.schemaVersion,
      evidenceRefs: input.request.evidenceRefs,
      confidence: typeof payload === "object" && payload !== null && typeof (payload as { confidence?: unknown }).confidence === "number"
        ? (payload as { confidence: number }).confidence
        : 0,
      createdAt,
      result: payload,
    });
  }

  return VisionTaskResultSchema.parse({
    id: input.request.id,
    taskType: input.request.taskType,
    modelRole: input.request.modelRole,
    provider: "local",
    runtime: input.roleConfig.runtime,
    model: input.roleConfig.model,
    implementationStatus: "model_backed",
    promptVersion: input.request.promptVersion,
    schemaVersion: input.request.schemaVersion,
    evidenceRefs: input.request.evidenceRefs,
    confidence: (payload as { confidence: number }).confidence,
    createdAt,
    result: payload,
  });
}

function buildNextItemParsedDecision(payload: { targetCandidates: unknown[] }) {
  return `target_candidates:${payload.targetCandidates.length}`;
}

function buildProductPresenceParsedDecision(payload: { isProductVideo: boolean | null }) {
  return payload.isProductVideo === true ? "product_yes" : payload.isProductVideo === false ? "product_no" : "product_uncertain";
}

export async function executeVisionRuntimeTask(input: RuntimeExecutionInput, createdAt: string) {
  const request = input.request as SupportedVisionRequest;
  const artifacts = resolveVisionRequestArtifacts(request);

  await input.debugHook?.(buildVisionDebugStartPayload(input, artifacts));

  const responseText = await input.ollamaAdapter.invokeVisionTask({
    modelName: input.roleConfig.model,
    prompt: artifacts.prompt,
    imagePaths: artifacts.imagePaths,
    timeoutMs: 60_000,
    ...(input.signal ? { signal: input.signal } : {}),
    ...(input.debugHook ? { debugHook: input.debugHook } : {}),
  });
  if (request.taskType === "vision.nextItemTargetCandidate" || request.taskType === "vision.commentsEntryTargetCandidate") {
    const visionOutput = request.taskType === "vision.commentsEntryTargetCandidate"
      ? parseCommentsEntryTargetCandidateRuntimeOutput(responseText, request)
      : parseNextItemTargetCandidateRuntimeOutput(responseText, request);
    await input.debugHook?.({
      eventType: "local_ai_output_normalized",
      detail: `taskType=${request.taskType}; adjusted=${String(visionOutput.adjusted)}; normalizedTargetCandidates=${visionOutput.normalizedCandidateCount}`,
      taskType: request.taskType,
      rawResponsePreview: buildPromptPreview(responseText),
      rawResponseText: responseText,
      parsedJson: visionOutput.payload,
      parsedDecision: buildNextItemParsedDecision(visionOutput.payload),
    });
    const payload = visionOutput.payload;
    await input.debugHook?.({
      eventType: "local_ai_output_parsed",
      detail: `taskType=${request.taskType}; confidence=${payload.confidence}; targetCandidates=${payload.targetCandidates.length}; reason=${buildPromptPreview(payload.reason)}`,
      taskType: request.taskType,
      parsedJson: payload,
      parsedDecision: buildNextItemParsedDecision(payload),
    });
    return buildVisionTaskResult(input, createdAt, payload);
  }

  const visionOutput = parseVisionRuntimeOutput(responseText, request);
  await input.debugHook?.({
    eventType: "local_ai_output_normalized",
    detail: `taskType=${request.taskType}; adjusted=${String(visionOutput.adjusted)}; normalizedFrameLevelObservations=${visionOutput.normalizedFrameCount}`,
    taskType: request.taskType,
    rawResponsePreview: buildPromptPreview(responseText),
    rawResponseText: responseText,
    parsedJson: visionOutput.payload,
    parsedDecision: buildProductPresenceParsedDecision(visionOutput.payload),
  });
  const payload = visionOutput.payload;
  await input.debugHook?.({
    eventType: "local_ai_output_parsed",
    detail: `taskType=${request.taskType}; confidence=${payload.confidence}; isProductVideo=${String(payload.isProductVideo)}; reason=${buildPromptPreview(payload.reason)}`,
    taskType: request.taskType,
    parsedJson: payload,
    parsedDecision: buildProductPresenceParsedDecision(payload),
  });

  return buildVisionTaskResult(input, createdAt, payload);
}
