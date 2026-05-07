import { PagePreparationTaskResultSchema } from "../../types/local-ai.js";
import { parsePagePreparationRuntimeOutput } from "./local-ai-runtime-page-preparation.js";
import { buildPagePreparationPromptParts } from "./local-ai-runtime-page-preparation-prompt.js";
import {
  buildPromptPreview,
  hashText,
  isFullAiIoDebugEnabled,
  type RuntimeExecutionInput,
} from "./local-ai-runtime-task-support.js";

function resolvePagePreparationRequestArtifacts(
  request: Extract<RuntimeExecutionInput["request"], { taskType: "vision.pagePreparation" }>,
) {
  const imagePaths = request.evidenceRefs
    .map((ref) => ref.filePath)
    .filter((filePath): filePath is string => typeof filePath === "string" && filePath.length > 0);
  const promptParts = buildPagePreparationPromptParts(request);
  return {
    imagePaths,
    promptParts,
    prompt: promptParts.fullPrompt,
    promptFullText: isFullAiIoDebugEnabled() ? promptParts.fullPrompt : undefined,
    sourceScreenshotEvidenceId: typeof request.input.screenshotEvidenceId === "string" ? request.input.screenshotEvidenceId : undefined,
    aiInputArtifactRef: request.input.contactSheetEvidenceId ?? request.input.multiFrameEvidenceSetId ?? request.evidenceRefs[0]?.id,
  };
}

function buildPagePreparationDebugStartPayload(
  input: RuntimeExecutionInput,
  artifacts: ReturnType<typeof resolvePagePreparationRequestArtifacts>,
) {
  const request = input.request as Extract<typeof input.request, { taskType: "vision.pagePreparation" }>;
  return {
    eventType: "local_ai_runtime_request_started" as const,
    detail: `taskType=${request.taskType}; model=${input.roleConfig.model}; timeoutMs=60000; promptLength=${artifacts.prompt.length}; imageCount=${artifacts.imagePaths.length}`,
    taskType: request.taskType,
    promptContractId: "vision.pagePreparation.v1",
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

function buildPagePreparationTaskResult(
  input: RuntimeExecutionInput,
  createdAt: string,
  payload: ReturnType<typeof parsePagePreparationRuntimeOutput>["payload"],
) {
  return PagePreparationTaskResultSchema.parse({
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
    confidence: payload.confidence,
    createdAt,
    result: payload,
  });
}

export async function executePagePreparationRuntimeTask(input: RuntimeExecutionInput, createdAt: string) {
  const request = input.request as Extract<typeof input.request, { taskType: "vision.pagePreparation" }>;
  const artifacts = resolvePagePreparationRequestArtifacts(request);

  await input.debugHook?.(buildPagePreparationDebugStartPayload(input, artifacts));

  const responseText = await input.ollamaAdapter.invokeVisionTask({
    modelName: input.roleConfig.model,
    prompt: artifacts.prompt,
    imagePaths: artifacts.imagePaths,
    timeoutMs: 60_000,
    ...(input.signal ? { signal: input.signal } : {}),
    ...(input.debugHook ? { debugHook: input.debugHook } : {}),
  });
  const pagePreparationOutput = parsePagePreparationRuntimeOutput(responseText, request);
  const payload = pagePreparationOutput.payload;
  await input.debugHook?.({
    eventType: "local_ai_output_parsed",
    detail: `taskType=${request.taskType}; confidence=${payload.confidence}; decision=${payload.decision}; reason=${buildPromptPreview(payload.reason)}`,
    taskType: request.taskType,
    parsedJson: payload,
    parsedDecision: payload.decision,
  });

  return buildPagePreparationTaskResult(input, createdAt, payload);
}