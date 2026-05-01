import type { LocalAiModelConfig } from "./model-config.js";
import type { LocalAiRuntimeError } from "./local-ai-runtime-error.js";
import { LocalAiHealthSchema, type LocalAiHealth, type LocalAiInvocationStatus, type LocalAiTaskRequest } from "../../types/local-ai.js";

type LocalAiExecutionSnapshot = {
  lastTaskType: LocalAiTaskRequest["taskType"] | null;
  lastFailureReason: string | null;
  lastInvocationStatus: LocalAiInvocationStatus | null;
};

type LocalAiRuntimeDependencyStatus = "ready" | "missing" | "unreachable" | "unavailable";
type AdapterHealth = { status: LocalAiRuntimeDependencyStatus; availableModels: string[] };
type OcrAdapterHealth = { status: LocalAiRuntimeDependencyStatus };

const toDependencyStatus = (runtimeStatus: LocalAiRuntimeDependencyStatus) => runtimeStatus;

const buildConfiguredModels = (modelConfig: LocalAiModelConfig) => ({
  vision: modelConfig.roles.vision.model,
  commentUnderstanding: modelConfig.roles.commentUnderstanding.model,
  ocr: modelConfig.roles.ocr.model,
  productSignal: modelConfig.roles.productSignal.model,
});

const getModelStatus = (availableModels: string[], runtimeStatus: LocalAiRuntimeDependencyStatus, modelName: string) =>
  runtimeStatus === "ready" ? (availableModels.includes(modelName) ? "ready" : "missing") : "unavailable";

const getOcrStatus = (runtimeStatus: LocalAiRuntimeDependencyStatus) =>
  runtimeStatus === "ready" ? "ready" : (runtimeStatus === "missing" ? "missing" : "unavailable");

const getOverallStatus = (statuses: Array<"ready" | "missing" | "unavailable">) =>
  statuses.every((status) => status === "ready")
    ? "ready"
    : statuses.some((status) => status === "ready")
      ? "degraded"
      : "unavailable";

export function getInvocationStatusFromRuntimeError(error: LocalAiRuntimeError): LocalAiInvocationStatus {
  if (error.code === "invalid_output") {
    return "invalid_ai_output";
  }
  if (error.code === "disabled_by_policy") {
    return "disabled_by_policy";
  }
  return "local_ai_unavailable";
}

export function buildUnavailableHealth(snapshot: LocalAiExecutionSnapshot, message: string): LocalAiHealth {
  return LocalAiHealthSchema.parse({
    overallStatus: "unavailable",
    implementationStatus: "configured-not-connected",
    ollamaStatus: "unavailable",
    visionModelStatus: "unavailable",
    textModelStatus: "unavailable",
    ocrStatus: "unavailable",
    configuredModels: {
      vision: "unknown",
      commentUnderstanding: "unknown",
      ocr: "unknown",
      productSignal: "unknown",
    },
    availableModels: [],
    lastCheckedAt: new Date().toISOString(),
    failureReason: message,
    ...snapshot,
  });
}

export function buildReadyHealth(
  snapshot: LocalAiExecutionSnapshot,
  modelConfig: LocalAiModelConfig,
  ollamaHealth: AdapterHealth,
  ocrHealth: OcrAdapterHealth,
): LocalAiHealth {
  const configuredModels = buildConfiguredModels(modelConfig);
  const availableModels = ollamaHealth.availableModels;
  const visionModelStatus = getModelStatus(availableModels, ollamaHealth.status, configuredModels.vision);
  const textModelStatus = getModelStatus(availableModels, ollamaHealth.status, configuredModels.commentUnderstanding);
  const resolvedOcrStatus = getOcrStatus(ocrHealth.status);
  const overallStatus = getOverallStatus([visionModelStatus, textModelStatus, resolvedOcrStatus]);
  return LocalAiHealthSchema.parse({
    overallStatus,
    implementationStatus: overallStatus === "unavailable" ? "local_ai_unavailable" : "model_backed",
    ollamaStatus: toDependencyStatus(ollamaHealth.status),
    visionModelStatus,
    textModelStatus,
    ocrStatus: resolvedOcrStatus,
    configuredModels,
    availableModels,
    lastCheckedAt: new Date().toISOString(),
    failureReason: overallStatus === "ready"
      ? null
      : `ollama=${ollamaHealth.status}; vision=${visionModelStatus}; text=${textModelStatus}; ocr=${resolvedOcrStatus}`,
    ...snapshot,
  });
}

export function buildLocalAiHealthDetail(health: LocalAiHealth, promptCount: number): string {
  return `ollama=${health.ollamaStatus}; vision=${health.visionModelStatus}; text=${health.textModelStatus}; ocr=${health.ocrStatus}; prompts=${promptCount}`;
}

export type { LocalAiExecutionSnapshot };