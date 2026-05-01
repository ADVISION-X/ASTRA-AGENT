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

export async function executeVisionRuntimeTask(input: RuntimeExecutionInput, createdAt: string) {
  const request = input.request as Extract<typeof input.request, { taskType: "vision.productPresence" }>;
  const imagePaths = request.evidenceRefs.map((ref) => ref.filePath).filter((filePath): filePath is string => typeof filePath === "string" && filePath.length > 0);
  const promptParts = buildVisionPromptParts(request);
  const prompt = promptParts.fullPrompt;
  const promptFullText = isFullAiIoDebugEnabled() ? promptParts.fullPrompt : undefined;
  const sourceScreenshotEvidenceId = typeof request.input.screenshotEvidenceId === "string" ? request.input.screenshotEvidenceId : undefined;
  const aiInputArtifactRef = request.input.contactSheetEvidenceId ?? request.input.multiFrameEvidenceSetId ?? request.evidenceRefs[0]?.id;

  await input.debugHook?.({
    eventType: "local_ai_runtime_request_started",
    detail: `taskType=${request.taskType}; model=${input.roleConfig.model}; timeoutMs=60000; promptLength=${prompt.length}; imageCount=${imagePaths.length}`,
    taskType: request.taskType,
    promptContractId: "vision.productPresence.v1",
    promptVersion: request.promptVersion,
    outputSchemaRef: request.schemaVersion,
    modelName: input.roleConfig.model,
    modelRole: request.modelRole,
    runtime: input.roleConfig.runtime,
    systemPromptText: promptParts.systemPrompt,
    userPromptText: promptParts.userPrompt,
    systemPromptHash: hashText(promptParts.systemPrompt),
    userPromptHash: hashText(promptParts.userPrompt),
    promptPreview: buildPromptPreview(promptParts.fullPrompt),
    ...(promptFullText ? { promptFullText } : {}),
    ...(sourceScreenshotEvidenceId ? { sourceScreenshotEvidenceId } : {}),
    ...(aiInputArtifactRef ? { aiInputArtifactRef } : {}),
    imageInputs: request.evidenceRefs.map((ref) => ({
      refId: ref.id,
      filePath: ref.filePath ?? "",
    })),
  });

  const responseText = await input.ollamaAdapter.invokeVisionTask({
    modelName: input.roleConfig.model,
    prompt,
    imagePaths,
    timeoutMs: 60_000,
    ...(input.debugHook ? { debugHook: input.debugHook } : {}),
  });
  const visionOutput = parseVisionRuntimeOutput(responseText, request);
  if (visionOutput.adjusted) {
    await input.debugHook?.({
      eventType: "local_ai_output_normalized",
      detail: `taskType=${request.taskType}; normalizedFrameLevelObservations=${visionOutput.normalizedFrameCount}`,
    });
  }
  const payload = visionOutput.payload;
  await input.debugHook?.({
    eventType: "local_ai_output_parsed",
    detail: `taskType=${request.taskType}; confidence=${payload.confidence}; isProductVideo=${String(payload.isProductVideo)}; reason=${buildPromptPreview(payload.reason)}`,
    taskType: request.taskType,
    parsedJson: payload,
    parsedDecision: payload.isProductVideo === true ? "product_yes" : payload.isProductVideo === false ? "product_no" : "product_uncertain",
  });

  return VisionTaskResultSchema.parse({
    id: request.id,
    taskType: request.taskType,
    modelRole: request.modelRole,
    provider: "local",
    runtime: input.roleConfig.runtime,
    model: input.roleConfig.model,
    implementationStatus: "model_backed",
    promptVersion: request.promptVersion,
    schemaVersion: request.schemaVersion,
    evidenceRefs: request.evidenceRefs,
    confidence: payload.confidence,
    createdAt,
    result: payload,
  });
}
