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

function buildCommentSignalDebugStartPayload(input: RuntimeExecutionInput, promptParts: ReturnType<typeof buildCommentPromptParts>, promptFullText: string | undefined, aiInputArtifactRef: string | undefined) {
  return {
    eventType: "local_ai_runtime_request_started" as const,
    detail: `taskType=${input.request.taskType}; model=${input.roleConfig.model}; timeoutMs=30000; commentCount=${(input.request as Extract<typeof input.request, { taskType: "comments.intent_analysis" }>).input.cleanedComments.length}`,
    taskType: input.request.taskType,
    promptContractId: input.request.promptVersion,
    promptVersion: input.request.promptVersion,
    outputSchemaRef: input.request.schemaVersion,
    modelName: input.roleConfig.model,
    modelRole: input.request.modelRole,
    runtime: input.roleConfig.runtime,
    systemPromptText: promptParts.systemPrompt,
    userPromptText: promptParts.userPrompt,
    systemPromptHash: hashText(promptParts.systemPrompt),
    userPromptHash: hashText(promptParts.userPrompt),
    promptPreview: buildPromptPreview(promptParts.fullPrompt),
    ...(promptFullText ? { promptFullText } : {}),
    ...(aiInputArtifactRef ? { aiInputArtifactRef } : {}),
  };
}

function buildCommentSignalResult(input: RuntimeExecutionInput, createdAt: string, payload: ReturnType<typeof CommentSignalPayloadSchema.parse>) {
  return CommentSignalTaskResultSchema.parse({
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

export async function executeCommentSignalRuntimeTask(input: RuntimeExecutionInput, createdAt: string) {
  const request = input.request as Extract<typeof input.request, { taskType: "comments.intent_analysis" }>;
  const promptParts = buildCommentPromptParts(request);
  const promptFullText = isFullAiIoDebugEnabled() ? promptParts.fullPrompt : undefined;
  const aiInputArtifactRef = request.evidenceRefs[0]?.id;

  await input.debugHook?.(buildCommentSignalDebugStartPayload(input, promptParts, promptFullText, aiInputArtifactRef));

  const responseText = await input.ollamaAdapter.invokeTextTask({
    modelName: input.roleConfig.model,
    prompt: promptParts.fullPrompt,
    timeoutMs: 30_000,
    ...(input.signal ? { signal: input.signal } : {}),
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
  return buildCommentSignalResult(input, createdAt, payload);
}
