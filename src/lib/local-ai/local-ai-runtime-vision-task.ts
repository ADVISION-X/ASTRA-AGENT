import { VisionTaskResultSchema } from "../../types/local-ai.js";
import { parseVisionRuntimeOutput } from "./local-ai-runtime-vision.js";
import { buildVisionPromptParts } from "./local-ai-runtime-vision-prompt.js";
import {
  MODEL_TIMEOUT_MS,
  buildPromptPreview,
  hashText,
  isFullAiIoDebugEnabled,
  type RuntimeExecutionInput,
} from "./local-ai-runtime-task-support.js";

function resolveVisionRequestArtifacts(request: Extract<RuntimeExecutionInput["request"], { taskType: "vision.productPresence" }>) {
  const imagePaths = request.evidenceRefs.map((ref) => ref.filePath).filter((filePath): filePath is string => typeof filePath === "string" && filePath.length > 0);
  const promptParts = buildVisionPromptParts(request);
  return {
    imagePaths,
    promptParts,
    prompt: promptParts.fullPrompt,
    promptFullText: isFullAiIoDebugEnabled() ? promptParts.fullPrompt : undefined,
    sourceScreenshotEvidenceId: typeof request.input.screenshotEvidenceId === "string" ? request.input.screenshotEvidenceId : undefined,
    aiInputArtifactRef: request.input.contactSheetEvidenceId ?? request.input.multiFrameEvidenceSetId ?? request.evidenceRefs[0]?.id,
  };
}

function buildVisionDebugStartPayload(input: RuntimeExecutionInput, artifacts: ReturnType<typeof resolveVisionRequestArtifacts>) {
  const request = input.request as Extract<typeof input.request, { taskType: "vision.productPresence" }>;
  return {
    eventType: "local_ai_runtime_request_started" as const,
    detail: `taskType=${request.taskType}; model=${input.roleConfig.model}; timeoutMs=60000; promptLength=${artifacts.prompt.length}; imageCount=${artifacts.imagePaths.length}`,
    taskType: request.taskType,
    promptContractId: "vision.productPresence.v1",
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

function buildVisionTaskResult(input: RuntimeExecutionInput, createdAt: string, payload: ReturnType<typeof parseVisionRuntimeOutput>["payload"]) {
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
    confidence: payload.confidence,
    createdAt,
    result: payload,
  });
}

export async function executeVisionRuntimeTask(input: RuntimeExecutionInput, createdAt: string) {
  const request = input.request as Extract<typeof input.request, { taskType: "vision.productPresence" }>;
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
  const visionOutput = parseVisionRuntimeOutput(responseText, request);
  await input.debugHook?.({
    eventType: "local_ai_output_normalized",
    detail: `taskType=${request.taskType}; adjusted=${String(visionOutput.adjusted)}; normalizedFrameLevelObservations=${visionOutput.normalizedFrameCount}`,
    taskType: request.taskType,
    rawResponsePreview: buildPromptPreview(responseText),
    rawResponseText: responseText,
    parsedJson: visionOutput.payload,
    parsedDecision: visionOutput.payload.isProductVideo === true ? "product_yes" : visionOutput.payload.isProductVideo === false ? "product_no" : "product_uncertain",
  });
  const payload = visionOutput.payload;
  await input.debugHook?.({
    eventType: "local_ai_output_parsed",
    detail: `taskType=${request.taskType}; confidence=${payload.confidence}; isProductVideo=${String(payload.isProductVideo)}; reason=${buildPromptPreview(payload.reason)}`,
    taskType: request.taskType,
    parsedJson: payload,
    parsedDecision: payload.isProductVideo === true ? "product_yes" : payload.isProductVideo === false ? "product_no" : "product_uncertain",
  });

  return buildVisionTaskResult(input, createdAt, payload);
}
