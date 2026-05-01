import { OcrTaskResultSchema } from "../../types/local-ai.js";
import {
  MODEL_TIMEOUT_MS,
  normalizeOcrText,
  type RuntimeExecutionInput,
} from "./local-ai-runtime-task-support.js";

export async function executeOcrCleanupRuntimeTask(input: RuntimeExecutionInput, createdAt: string) {
  const request = input.request as Extract<typeof input.request, { taskType: "comments.ocr_cleanup" }>;
  const imagePath = request.evidenceRefs.find((ref) => typeof ref.filePath === "string")?.filePath;
  if (!imagePath) {
    throw new Error("OCR cleanup requires screenshot evidence with a file path.");
  }
  const ocrInputArtifactRef = request.evidenceRefs[0]?.id;
  await input.debugHook?.({
    eventType: "local_ai_runtime_request_started",
    detail: `taskType=${request.taskType}; model=${input.roleConfig.model}; timeoutMs=${MODEL_TIMEOUT_MS.ocr}; imageCount=1`,
    taskType: request.taskType,
    promptContractId: request.promptVersion,
    promptVersion: request.promptVersion,
    outputSchemaRef: request.schemaVersion,
    modelName: input.roleConfig.model,
    modelRole: request.modelRole,
    runtime: input.roleConfig.runtime,
    ...(ocrInputArtifactRef ? { aiInputArtifactRef: ocrInputArtifactRef } : {}),
    imageInputs: request.evidenceRefs.map((ref) => ({
      refId: ref.id,
      filePath: ref.filePath ?? "",
    })),
  });
  const ocrText = await input.ocrAdapter.invokeOcrTask({
    toolName: input.roleConfig.model,
    imagePath,
    timeoutMs: MODEL_TIMEOUT_MS.ocr,
    ...(input.debugHook ? { debugHook: input.debugHook } : {}),
  });
  const payload = normalizeOcrText(ocrText);
  await input.debugHook?.({
    eventType: "local_ai_output_parsed",
    detail: `taskType=${request.taskType}; cleanedComments=${payload.cleanedComments.length}; uncertainText=${payload.uncertainText.length}`,
    taskType: request.taskType,
    parsedJson: payload,
    parsedDecision: payload.cleanedComments.length > 0 ? "ocr_cleaned" : "ocr_empty",
  });
  return OcrTaskResultSchema.parse({
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
