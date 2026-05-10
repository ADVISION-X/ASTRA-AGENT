import { parseCommentsEntryTargetCandidateRuntimeOutput } from "./local-ai-runtime-comments-entry-target-candidate.js";
import { buildCommentsEntryTargetCandidatePromptParts } from "./local-ai-runtime-comments-entry-target-candidate-prompt.js";
import { parseNextItemTargetCandidateRuntimeOutput } from "./local-ai-runtime-target-candidate.js";
import { buildNextItemTargetCandidatePromptParts } from "./local-ai-runtime-target-candidate-prompt.js";
import { parseVisionRuntimeOutput } from "./local-ai-runtime-vision.js";
import { buildVisionPromptParts } from "./local-ai-runtime-vision-prompt.js";
import {
  handleVisionProductPresenceRuntimeTask,
  handleVisionTargetCandidateRuntimeTask,
} from "./local-ai-runtime-vision-task-handlers.js";
import {
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
      : "visual-mission-judge.v1",
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
    return handleVisionTargetCandidateRuntimeTask(input, createdAt, request, responseText);
  }

  return handleVisionProductPresenceRuntimeTask(input, createdAt, request, responseText);
}
