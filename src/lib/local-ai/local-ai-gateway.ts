import { getModelRoleConfig, loadLocalAiModelConfig, type LocalAiModelConfig } from "./model-config.js";
import { getPromptContract, getRequiredModelRole, listPromptContracts } from "./prompt-registry.js";
import { executeRuntimeTask } from "./local-ai-runtime-execution.js";
import { LocalAiRuntimeError } from "./local-ai-runtime-error.js";
import { LocalOcrRuntimeAdapter } from "./runtime-adapters/local-ocr-runtime-adapter.js";
import { OllamaRuntimeAdapter } from "./runtime-adapters/ollama-runtime-adapter.js";
import type { LocalAiDebugHook } from "./runtime-adapters/local-ai-runtime-adapter.js";
import { executeGovernedTask } from "./governed-task-execution.js";
import {
  LocalAiHealthSchema,
  LocalAiTaskRequestSchema,
  type LocalAiHealth,
  type LocalAiInvocationStatus,
  type LocalAiTaskRequest,
  type LocalAiTaskResult,
} from "../../types/local-ai.js";

type LocalAiExecutionMode = "real-platform" | "fixture_mode" | "demo_mode" | "dev_stub_mode";

const toDependencyStatus = (runtimeStatus: "ready" | "missing" | "unreachable" | "unavailable") => runtimeStatus;

const buildConfiguredModels = (modelConfig: LocalAiModelConfig) => ({
  vision: modelConfig.roles.vision.model,
  commentUnderstanding: modelConfig.roles.commentUnderstanding.model,
  ocr: modelConfig.roles.ocr.model,
  productSignal: modelConfig.roles.productSignal.model,
});

const getModelStatus = (availableModels: string[], runtimeStatus: "ready" | "missing" | "unreachable" | "unavailable", modelName: string) =>
  runtimeStatus === "ready" ? (availableModels.includes(modelName) ? "ready" : "missing") : "unavailable";

const getOcrStatus = (runtimeStatus: "ready" | "missing" | "unreachable" | "unavailable") =>
  runtimeStatus === "ready" ? "ready" : (runtimeStatus === "missing" ? "missing" : "unavailable");

const getOverallStatus = (statuses: Array<"ready" | "missing" | "unavailable">) =>
  statuses.every((status) => status === "ready")
    ? "ready"
    : statuses.some((status) => status === "ready")
      ? "degraded"
      : "unavailable";

const getInvocationStatusFromRuntimeError = (error: LocalAiRuntimeError): LocalAiInvocationStatus => {
  if (error.code === "invalid_output") {
    return "invalid_ai_output";
  }
  if (error.code === "disabled_by_policy") {
    return "disabled_by_policy";
  }
  return "local_ai_unavailable";
};

export class LocalAiGateway {
  private readonly modelConfigPromise: Promise<LocalAiModelConfig>;
  private readonly ollamaAdapter: OllamaRuntimeAdapter;
  private readonly ocrAdapter: LocalOcrRuntimeAdapter;
  private lastTaskType: LocalAiTaskRequest["taskType"] | null = null;
  private lastFailureReason: string | null = null;
  private lastInvocationStatus: LocalAiInvocationStatus | null = null;

  constructor(options?: { modelConfig?: LocalAiModelConfig; modelConfigPromise?: Promise<LocalAiModelConfig> }) {
    this.modelConfigPromise = options?.modelConfig
      ? Promise.resolve(options.modelConfig)
      : options?.modelConfigPromise ?? loadLocalAiModelConfig();
    this.ollamaAdapter = new OllamaRuntimeAdapter();
    this.ocrAdapter = new LocalOcrRuntimeAdapter();
  }

  private getInvocationSnapshot() {
    return {
      lastTaskType: this.lastTaskType,
      lastFailureReason: this.lastFailureReason,
      lastInvocationStatus: this.lastInvocationStatus,
    };
  }

  private buildUnavailableHealth(message: string): LocalAiHealth {
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
      ...this.getInvocationSnapshot(),
    });
  }

  private buildReadyHealth(
    modelConfig: LocalAiModelConfig,
    ollamaHealth: Awaited<ReturnType<OllamaRuntimeAdapter["getHealth"]>>,
    ocrHealth: Awaited<ReturnType<LocalOcrRuntimeAdapter["getHealth"]>>,
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
      ...this.getInvocationSnapshot(),
    });
  }

  private getHealthDetail(health: LocalAiHealth): string {
    return `ollama=${health.ollamaStatus}; vision=${health.visionModelStatus}; text=${health.textModelStatus}; ocr=${health.ocrStatus}; prompts=${listPromptContracts().length}`;
  }

  async getHealth(): Promise<{ ok: boolean; detail: string; health: LocalAiHealth }> {
    try {
      const modelConfig = await this.modelConfigPromise;
      const [ollamaHealth, ocrHealth] = await Promise.all([this.ollamaAdapter.getHealth(), this.ocrAdapter.getHealth()]);
      const health = this.buildReadyHealth(modelConfig, ollamaHealth, ocrHealth);
      return {
        ok: health.overallStatus === "ready",
        detail: this.getHealthDetail(health),
        health,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const health = this.buildUnavailableHealth(message);
      return {
        ok: false,
        detail: `local AI config error: ${message}`,
        health,
      };
    }
  }

  async getRuntimeHealth(): Promise<LocalAiHealth> {
    const report = await this.getHealth();
    return report.health;
  }

  async resolveGovernedRoleConfig(request: LocalAiTaskRequest) {
    const contract = getPromptContract(request.taskType);
    const expectedModelRole = getRequiredModelRole(request.taskType);
    const modelConfig = await this.modelConfigPromise;
    const roleConfig = getModelRoleConfig(modelConfig, expectedModelRole);

    if (request.modelRole !== expectedModelRole) {
      throw new Error(`Local AI request modelRole ${request.modelRole} does not match governed role ${expectedModelRole} for ${request.taskType}.`);
    }
    if (request.promptVersion !== contract.promptVersion || request.schemaVersion !== contract.schemaVersion) {
      throw new Error(`Local AI request contract drift detected for ${request.taskType}.`);
    }
    if (roleConfig.promptVersion !== contract.promptVersion || roleConfig.schemaVersion !== contract.schemaVersion) {
      throw new Error(`Local AI model config drift detected for ${request.taskType}.`);
    }

    return roleConfig;
  }

  async execute(requestInput: LocalAiTaskRequest, options?: { executionMode?: LocalAiExecutionMode; debugHook?: LocalAiDebugHook }): Promise<LocalAiTaskResult> {
    const request = LocalAiTaskRequestSchema.parse(requestInput);
    const roleConfig = await this.resolveGovernedRoleConfig(request);
    this.lastTaskType = request.taskType;

    if (options?.executionMode && options.executionMode !== "real-platform") {
      this.lastInvocationStatus = "success";
      this.lastFailureReason = null;
      return executeGovernedTask(request, roleConfig, new Date().toISOString());
    }

    try {
      const result = await executeRuntimeTask({
        request,
        roleConfig,
        ollamaAdapter: this.ollamaAdapter,
        ocrAdapter: this.ocrAdapter,
        ...(options?.debugHook ? { debugHook: options.debugHook } : {}),
      });
      this.lastInvocationStatus = "success";
      this.lastFailureReason = null;
      return result;
    } catch (error) {
      if (error instanceof LocalAiRuntimeError) {
        this.lastFailureReason = error.message;
        this.lastInvocationStatus = getInvocationStatusFromRuntimeError(error);
      }
      throw error;
    }
  }
}