import { VisualMissionActionPlanOutputSchema } from "../../types/visual-mission-action-plan.js";
import { LocalAiVisualMissionActionPlanTaskResultSchema } from "../../types/local-ai.js";
import {
  buildPromptPreview,
  hashText,
  isFullAiIoDebugEnabled,
  toJsonPayload,
  type RuntimeExecutionInput,
} from "./local-ai-runtime-task-support.js";
import { buildLocalAiVisualMissionActionPlanPromptParts } from "./local-ai-runtime-visual-mission-action-plan-prompt.js";

type VisualMissionActionPlanRequest = Extract<RuntimeExecutionInput["request"], { taskType: "vision.visualMissionActionPlan" }>;

function resolveArtifacts(request: VisualMissionActionPlanRequest) {
  const promptParts = buildLocalAiVisualMissionActionPlanPromptParts(request.input);
  return {
    imagePaths: request.evidenceRefs.map((ref) => ref.filePath).filter((filePath): filePath is string => typeof filePath === "string" && filePath.length > 0),
    promptParts,
  };
}

function buildDebugStartPayload(input: RuntimeExecutionInput, request: VisualMissionActionPlanRequest, promptParts: ReturnType<typeof resolveArtifacts>["promptParts"]) {
  return {
    eventType: "local_ai_runtime_request_started" as const,
    detail: `taskType=${request.taskType}; model=${input.roleConfig.model}; timeoutMs=60000; promptLength=${promptParts.fullPrompt.length}; imageCount=${request.evidenceRefs.length}`,
    taskType: request.taskType,
    promptContractId: promptParts.promptContractId,
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
    ...(isFullAiIoDebugEnabled() ? { promptFullText: promptParts.fullPrompt } : {}),
  };
}

export async function executeVisualMissionActionPlanRuntimeTask(input: RuntimeExecutionInput, createdAt: string) {
  const request = input.request as VisualMissionActionPlanRequest;
  const artifacts = resolveArtifacts(request);
  await input.debugHook?.(buildDebugStartPayload(input, request, artifacts.promptParts));

  const responseText = await input.ollamaAdapter.invokeVisionTask({
    modelName: input.roleConfig.model,
    prompt: artifacts.promptParts.fullPrompt,
    imagePaths: artifacts.imagePaths,
    timeoutMs: 60_000,
    ...(input.signal ? { signal: input.signal } : {}),
    ...(input.debugHook ? { debugHook: input.debugHook } : {}),
  });
  const payload = toJsonPayload(responseText, VisualMissionActionPlanOutputSchema, request.taskType);

  return LocalAiVisualMissionActionPlanTaskResultSchema.parse({
    id: request.id,
    taskType: "vision.visualMissionActionPlan",
    modelRole: "vision",
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