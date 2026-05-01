import {
  CommentSignalPayloadSchema,
  CommentSignalTaskResultSchema,
} from "../../types/local-ai.js";
import {
  buildCommentPromptParts,
  buildPromptPreview,
  hashText,
  isFullAiIoDebugEnabled,
  toJsonPayload,
  type RuntimeExecutionInput,
} from "./local-ai-runtime-task-support.js";

export async function executeCommentSignalRuntimeTask(input: RuntimeExecutionInput, createdAt: string) {
  const request = input.request as Extract<typeof input.request, { taskType: "comments.intent_analysis" }>;
  const promptParts = buildCommentPromptParts(request);
  const promptFullText = isFullAiIoDebugEnabled() ? promptParts.fullPrompt : undefined;
  const aiInputArtifactRef = request.evidenceRefs[0]?.id;

  await input.debugHook?.({
    eventType: "local_ai_runtime_request_started",
    detail: `taskType=${request.taskType}; model=${input.roleConfig.model}; timeoutMs=30000; commentCount=${request.input.cleanedComments.length}`,
    taskType: request.taskType,
    promptContractId: request.promptVersion,
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
    ...(aiInputArtifactRef ? { aiInputArtifactRef } : {}),
  });

  const responseText = await input.ollamaAdapter.invokeTextTask({
    modelName: input.roleConfig.model,
    prompt: promptParts.fullPrompt,
    timeoutMs: 30_000,
    ...(input.debugHook ? { debugHook: input.debugHook } : {}),
  });
  const payload = toJsonPayload(responseText, CommentSignalPayloadSchema, input.request.taskType);
  await input.debugHook?.({
    eventType: "local_ai_output_parsed",
    detail: `taskType=${request.taskType}; purchaseIntent=${payload.purchaseIntent}; confidence=${payload.confidence}`,
    taskType: request.taskType,
    parsedJson: payload,
    parsedDecision: payload.purchaseIntent,
  });
  return CommentSignalTaskResultSchema.parse({
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
